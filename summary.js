const fs = require('fs')
const { pipe, map, flatten, sortBy, prop, values, uniq, pluck, filter, trim } = require('ramda')

const statNames = {
  1: 'strength',
  2: 'dexterity',
  3: 'constitution',
  4: 'intelligence',
  5: 'wisdom',
  6: 'charisma',
}

const sources = ['race', 'background', 'class', 'item', 'feat']

const getStatName = (id) => statNames[id]

const mapTrim = (obj) => map((x) => trim(x), removeNulls(obj))

const removeNulls = (obj) => Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null))

const getStatObject = (property, data) =>
  Object.fromEntries(
    data[property]
      .map(({ id, value }) => (value ? [getStatName(id), value] : null))
      .filter(Boolean),
  )

const getInventoryItem = (item, characterValues) => {
  const name = item.definition.name
  const charVal = characterValues.find((cv) => cv.valueId === item.id.toString())

  if (charVal) {
    console.log(charVal)
    if (name.includes('Spell Scroll (')) {
      return `Scroll: ${charVal.value}`
    }
    return charVal.value
  }
  return name
}

const summarize = (player) => {
  const raw = fs.readFileSync(`json/${player}.json`)

  const data = JSON.parse(raw).data

  const {
    characterValues,
    background,
    inventory,
    classes,
    name,
    notes,
    traits,
    currencies,
    actions,
    feats,
    spells,
    classSpells,
    dateModified,
    modifiers,
  } = data

  const { cp, sp, gp, ep, pp } = currencies

  const _spells = pipe(
    values,
    flatten,
    filter(Boolean),
    map((x) => x.definition?.name),
  )(spells)

  const _classSpells = classSpells.map((cs) => cs.spells?.map((s) => s.definition.name)).flat()

  const final = {
    name,
    classes: classes.map(
      (c) =>
        `Level ${c.level} ${c.definition.name}${
          c.subclassDefinition ? ` | ${c.subclassDefinition.name}` : ''
        }`,
    ),
    stats: getStatObject('stats', data),
    hitPoints: {
      base: data.baseHitPoints,
      current: data.baseHitPoints - data.removedHitPoints,
      temp: data.temporaryHitPoints,
    },
    traits: mapTrim(traits),
    bonusStats: getStatObject('bonusStats', data),
    overrideStats: getStatObject('overrideStats', data),
    background: background.hasCustomBackground
      ? background.customBackground.name
      : background.definition.name,
    feats,
    spells: _spells.concat(_classSpells).sort(),
    actions: pipe(values, flatten, filter(Boolean), sortBy(prop('name')), pluck('name'))(actions),
    modifiers: pipe(
      values,
      flatten,
      sortBy(prop('type')),
      map((x) => `${x.friendlyTypeName} | ${x.friendlySubtypeName}`),
      uniq,
    )(modifiers),
    inventory: inventory.map((i) => getInventoryItem(i, characterValues)).sort(),
    currencies,
    money: cp / 100 + sp / 10 + ep / 2 + gp + pp * 10,
    notes: mapTrim(notes),
    // dateModified: moment(dateModified).format('LLLL'),
  }

  fs.writeFileSync(`summary/${player}.json`, JSON.stringify(final))
}

;['josh', 'corey', 'todd', 'gamel', 'jen'].forEach((player) => summarize(player))

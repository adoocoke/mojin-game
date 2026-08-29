import assert from 'node:assert/strict'
import test from 'node:test'
import { explorerNameKey, normalizeExplorerName, validateExplorerName } from './explorer-name.mjs'

test('normalize trims and collapses spaces', () => {
  assert.equal(normalizeExplorerName('  老  炮  '), '老 炮')
  assert.equal(normalizeExplorerName('\tAce\n'), 'Ace')
})

test('name key is case-insensitive', () => {
  assert.equal(explorerNameKey('Ace'), 'ace')
  assert.equal(explorerNameKey(' ACE '), 'ace')
})

test('validate accepts cjk and mixed names', () => {
  const a = validateExplorerName('摸金张三')
  assert.equal(a.ok, true)
  if (a.ok) assert.equal(a.name, '摸金张三')
  const b = validateExplorerName('Ace_01')
  assert.equal(b.ok, true)
})

test('validate rejects empty, too long, punctuation-only', () => {
  assert.equal(validateExplorerName('   ').ok, false)
  assert.equal(validateExplorerName('一二三四五六七八九十一二三').ok, false)
  assert.equal(validateExplorerName('___').ok, false)
})

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseExplicitMistake,
  tokenizeInputWithMistakes,
} from '../lib/page-compositor.ts'
import { estimateTextAdvanceWidth } from '../lib/allograph-engine.ts'

test('parseExplicitMistake recognises tildes with surrounding punctuation', () => {
  assert.equal(parseExplicitMistake('~forgt~'), 'forgt')
  assert.equal(parseExplicitMistake('~forgt~,'), 'forgt,')
  assert.equal(parseExplicitMistake('(~forgt~)'), '(forgt)')
  assert.equal(parseExplicitMistake('~~forgt~~'), 'forgt')
  assert.equal(parseExplicitMistake('"~forgt~".'), '"forgt".')
  assert.equal(parseExplicitMistake('forget'), null)
  assert.equal(parseExplicitMistake('~'), null)
  assert.equal(parseExplicitMistake('~~'), null)
  assert.equal(parseExplicitMistake('a~forgt~'), null, 'must wrap the whole word')
})

test('manual tilde mistakes become struck-through tokens', () => {
  const { tokens, mistakes } = tokenizeInputWithMistakes(
    'I really ~forgt~ forget things.',
    0,
    1
  )
  const manual = tokens.filter((t) => t.isExplicitMistake)
  assert.equal(manual.length, 1)
  assert.equal(manual[0].mistakenText, 'forgt')
  assert.equal(mistakes.length, 1)
  assert.equal(mistakes[0].kind, 'manual-strike')
  assert.equal(mistakes[0].intendedWord, '(manual cross-out)')
})

test('each paragraph gap is a single break token, not one per newline', () => {
  const single = tokenizeInputWithMistakes('first line\n\nsecond line', 0, 7).tokens
  const breaks = single.filter((t) => t.isParagraphBreak)
  assert.equal(breaks.length, 1)
  assert.equal(breaks[0].gapLines, 2)

  const hardBreak = tokenizeInputWithMistakes('first line\nsecond line', 0, 7).tokens
  const hardBreaks = hardBreak.filter((t) => t.isParagraphBreak)
  assert.equal(hardBreaks.length, 1)
  assert.equal(hardBreaks[0].gapLines, 1)

  const wide = tokenizeInputWithMistakes('one\n\n\n\ntwo', 0, 7).tokens
  assert.equal(wide.filter((t) => t.isParagraphBreak)[0].gapLines, 3, 'gaps are capped')

  const leading = tokenizeInputWithMistakes('\n\nstarts here', 0, 7).tokens
  assert.equal(leading.filter((t) => t.isParagraphBreak).length, 0, 'no leading gap')
})

test('sentence indices advance on terminal punctuation', () => {
  const { tokens } = tokenizeInputWithMistakes(
    'One sentence. Then another sentence! And a question?',
    0,
    3
  )
  const sentenceEnds = tokens.filter((t) => /[.!?]$/.test(t.raw))
  assert.equal(sentenceEnds.length, 3)
  assert.deepEqual(
    tokens.map((t) => t.sentenceIndex),
    [0, 0, 1, 1, 1, 2, 2, 2]
  )
})

test('automatic mistakes are deterministic for a seed and spaced out', () => {
  const text =
    'Everything about this particular afternoon felt completely different from the ' +
    'way we had planned it earlier, because nothing important ever happens twice in ' +
    'exactly the same manner, and nobody remembers the ordinary details anyway.'

  const first = tokenizeInputWithMistakes(text, 0.2, 12345)
  const second = tokenizeInputWithMistakes(text, 0.2, 12345)
  assert.deepEqual(
    first.mistakes.map((m) => m.mistakenText),
    second.mistakes.map((m) => m.mistakenText),
    'same seed should reproduce the same mistakes'
  )

  assert.ok(first.mistakes.length > 0, 'a high rate injects mistakes')
  assert.ok(first.mistakes.length < 6, 'mistakes are throttled, not sprayed everywhere')

  const positions = first.mistakes.map((m) =>
    first.tokens.findIndex((t) => t.mistakenText === m.mistakenText)
  )
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] - positions[i - 1] >= 7, 'at least 7 words between mistakes')
  }
})

test('a zero mistake rate never invents mistakes', () => {
  const { mistakes } = tokenizeInputWithMistakes(
    'Nothing should ever be crossed out on this page at all.',
    0,
    99
  )
  assert.equal(mistakes.length, 0)
})

test('advance estimation is positive, deterministic, and style aware', () => {
  const caveat = estimateTextAdvanceWidth('handwriting', 'everyday-ballpoint', 60)
  const narrow = estimateTextAdvanceWidth('iiii', 'everyday-ballpoint', 60)
  const wide = estimateTextAdvanceWidth('mmmm', 'everyday-ballpoint', 60)

  assert.ok(caveat > 0)
  assert.equal(caveat, estimateTextAdvanceWidth('handwriting', 'everyday-ballpoint', 60))
  assert.ok(wide > narrow, 'wide letters must be measured wider than narrow ones')
  assert.ok(
    estimateTextAdvanceWidth('word', 'everyday-ballpoint', 80) >
      estimateTextAdvanceWidth('word', 'everyday-ballpoint', 40),
    'larger writing takes more room'
  )
})

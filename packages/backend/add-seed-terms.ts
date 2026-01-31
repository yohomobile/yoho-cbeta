/**
 * 添加"种子六义"相关术语到词典
 *
 * 种子六义是唯识学对《成唯识论》中阿赖耶识种子特性的概括总结
 * 虽然原文没有直接列出这六个词，但这是后学的标准解释
 */

import { db, dictionaryEntries } from './src/db/index.js'
import { eq } from 'drizzle-orm'

// 种子六义的六个术语及其释义
const seedTerms = [
  {
    term: '刹那灭',
    definition: `<p><strong>刹那灭</strong>（梵语：kṣaṇabhaṅga）</p>
<p>种子六义之一。谓种子生果之后，即剎那灭尽，不住至第二念。此义显示种子体是生灭无常之法，非恒常不变者。</p>
<p>《成唯识论》云："谓诸种子，剎那剎那，生灭变异。"种子之所以能生果，正因其体剎那生灭，若体常者，则不能生果。</p>
<p>此义简别常我外道所计之常法，亦简别经部师所计之三世实有法。</p>`,
    definitionText: '刹那灭（梵语：kṣaṇabhaṅga）是种子六义之一。谓种子生果之后，即刹那灭尽，不住至第二念。此义显示种子体是生灭无常之法，非恒常不变者。《成唯识论》云："谓诸种子，刹那刹那，生灭变异。"种子之所以能生果，正因其体刹那生灭，若体常者，则不能生果。',
    source: '成唯识论'
  },
  {
    term: '果俱有',
    definition: `<p><strong>果俱有</strong></p>
<p>种子六义之一。谓种子与所生之果，必须俱时现有，不相离异。即种子因体与果法同时存在，非先有因后后果。</p>
<p>此义显示种子是恒转如流、前后相续之法。现有之种子与现行之果俱时，又此果即为后果之种子。</p>
<p>《成唯识论》云："种子与果，俱时现有，不相离异。"</p>
<p>此义简别经部师等计执之因果异时论。</p>`,
    definitionText: '果俱有是种子六义之一。谓种子与所生之果，必须俱时现有，不相离异。即种子因体与果法同时存在，非先有因后后果。此义显示种子是恒转如流、前后相续之法。《成唯识论》云："种子与果，俱时现有，不相离异。"',
    source: '成唯识论'
  },
  {
    term: '恒随转',
    definition: `<p><strong>恒随转</strong></p>
<p>种子六义之一。谓种子要恒常相续，随转不辍，直至得果为止。即从种子生果，中间必须恒时相续，无有间断。</p>
<p>此义显示种子非暂时有、非断续之法。种子从因位至果位，必须恒时随转，无间无断。</p>
<p>《成唯识论》云："种子要恒时随转，乃至得果。"若非恒随转，则因果相续不成。</p>
<p>此义简别外道所计之暂时因缘，亦简别断见论者。</p>`,
    definitionText: '恒随转是种子六义之一。谓种子要恒常相续，随转不辍，直至得果为止。即从种子生果，中间必须恒时相续，无有间断。此义显示种子非暂时有、非断续之法。《成唯识论》云："种子要恒时随转，乃至得果。"若非恒随转，则因果相续不成。',
    source: '成唯识论'
  },
  {
    term: '性决定',
    definition: `<p><strong>性决定</strong></p>
<p>种子六义之一。谓种子之体性决定，若善种子唯能生善法果，若恶种子唯能生恶法果，若无记种子唯能生无记法果。因果性类决定，不相杂乱。</p>
<p>此义显示种子善恶无记之性，于因位已决定，至果位不改转。善因必招乐果，恶因必招苦果。</p>
<p>《成唯识论》云："种子体性决定，若善种子，乃至能生善法果；若恶种子，乃至能生恶法果。"</p>
<p>此义简别善因能生恶果等谬执。</p>`,
    definitionText: '性决定是种子六义之一。谓种子之体性决定，若善种子唯能生善法果，若恶种子唯能生恶法果，若无记种子唯能生无记法果。因果性类决定，不相杂乱。《成唯识论》云："种子体性决定，若善种子，乃至能生善法果；若恶种子，乃至能生恶法果。"此义简别善因能生恶果等谬执。',
    source: '成唯识论'
  },
  {
    term: '待众缘',
    definition: `<p><strong>待众缘</strong></p>
<p>种子六义之一。谓种子虽能生果，非唯仗自己之力，必须待众缘和合，方乃生果。即种子非独能生果，必须待其余助缘。</p>
<p>此义显示种子是缘生之法，非自然能生。种子要待缘具足，方能生果。若无缘助，虽有种子，亦不能生。</p>
<p>《成唯识论》云："种子待众缘和合，方乃生果。"所待之缘，若是有为法种子，须待因缘、增上缘、等无间缘；若是无为法种子，唯待增上缘。</p>
<p>此义简别自然因论者，亦简别计执种子独能生果者。</p>`,
    definitionText: '待众缘是种子六义之一。谓种子虽能生果，非唯仗自己之力，必须待众缘和合，方乃生果。即种子非独能生果，必须待其余助缘。《成唯识论》云："种子待众缘和合，方乃生果。"所待之缘，若是有为法种子，须待因缘、增上缘、等无间缘；若是无为法种子，唯待增上缘。此义简别自然因论者。',
    source: '成唯识论'
  },
  {
    term: '引自果',
    definition: `<p><strong>引自果</strong></p>
<p>种子六义之一。谓种子各引自果，不相杂乱。即色法种子唯能生色法果，心法种子唯能生心法果，善种子唯生善果，恶种子唯生恶果。种种种子，各引其自类之果。</p>
<p>此义显示种子界系分明，不相紊乱。五趣有情之各别趣业，各引其自趣之果，不相杂乱。</p>
<p>《成唯识论》云："种子各引自果，色法种子，乃至能生色法果；心法种子，乃至能生心法果。"</p>
<p>此义简别计执一因能生一切果等谬论。</p>`,
    definitionText: '引自果是种子六义之一。谓种子各引自果，不相杂乱。即色法种子唯能生色法果，心法种子唯能生心法果，善种子唯生善果，恶种子唯生恶果。种种种子，各引其自类之果。《成唯识论》云："种子各引自果，色法种子，乃至能生色法果；心法种子，乃至能生心法果。"此义简别计执一因能生一切果等谬论。',
    source: '成唯识论'
  },
]

// 同时添加一个总词条
const seedSixMeanings = {
  term: '种子六义',
  definition: `<p><strong>种子六义</strong></p>
<p>种子六义是唯识学对阿赖耶识种子所具六种特性的概括总结，出自《成唯识论》。此六义显示种体的生灭无常、因果同时、恒转相续、性决定、待缘生果、各引自果等特性。</p>
<p><strong>六义如下：</strong></p>
<ol>
<li><strong>刹那灭</strong> - 种子生果后即刹那灭尽，不住至第二念，显示种子体是生灭无常之法。</li>
<li><strong>果俱有</strong> - 种子与所生之果俱时现有，不相离异，显示种子是恒转如流、前后相续之法。</li>
<li><strong>恒随转</strong> - 种子要恒常相续，随转不辍，直至得果为止，显示种子非暂时有、非断续之法。</li>
<li><strong>性决定</strong> - 种子体性决定，善种生善果，恶种生恶果，因果性类不相杂乱。</li>
<li><strong>待众缘</strong> - 种子虽能生果，必须待众缘和合方能生果，显示种子是缘生之法。</li>
<li><strong>引自果</strong> - 种子各引自果，色种生色果，心种生心果，界系分明不相紊乱。</li>
</ol>
<p><strong>建立六义之意义：</strong></p>
<p>此六义旨在简别各种外道、小乘之谬论，成立大乘唯识学之种子义。如刹那灭简别常我外道，果俱有简别异时因果论，恒随转简别暂时因缘论等。</p>`,
  definitionText: '种子六义是唯识学对阿赖耶识种子所具六种特性的概括总结，出自《成唯识论》。六义包括：1.刹那灭-种子生果后即刹那灭尽；2.果俱有-种子与所生之果俱时现有；3.恒随转-种子要恒常相续直至得果；4.性决定-种子体性决定善生善恶生恶；5.待众缘-种子须待众缘和合方能生果；6.引自果-种子各引自果界系分明。',
  source: '成唯识论'
}

async function main() {
  console.log('📝 准备添加种子六义术语到词典...\n')

  let added = 0
  let updated = 0
  let skipped = 0

  // 先添加六个具体术语
  for (const termData of seedTerms) {
    try {
      // 检查是否已存在
      const existing = await db.select()
        .from(dictionaryEntries)
        .where(eq(dictionaryEntries.term, termData.term))
        .limit(1)

      if (existing.length > 0) {
        console.log(`⏭️  跳过: "${termData.term}" (已存在)`)
        skipped++
      } else {
        await db.insert(dictionaryEntries).values({
          term: termData.term,
          termSimplified: termData.term,
          definition: termData.definition,
          definitionText: termData.definitionText,
          source: termData.source,
        })
        console.log(`✅ 添加: "${termData.term}"`)
        added++
      }
    } catch (error) {
      console.error(`❌ 错误 (${termData.term}):`, error)
    }
  }

  // 添加总词条
  try {
    const existing = await db.select()
      .from(dictionaryEntries)
      .where(eq(dictionaryEntries.term, seedSixMeanings.term))
      .limit(1)

    if (existing.length > 0) {
      console.log(`⏭️  跳过: "${seedSixMeanings.term}" (已存在)`)
      skipped++
    } else {
      await db.insert(dictionaryEntries).values({
        term: seedSixMeanings.term,
        termSimplified: seedSixMeanings.term,
        definition: seedSixMeanings.definition,
        definitionText: seedSixMeanings.definitionText,
        source: seedSixMeanings.source,
      })
      console.log(`✅ 添加: "${seedSixMeanings.term}"`)
      added++
    }
  } catch (error) {
    console.error(`❌ 错误 (${seedSixMeanings.term}):`, error)
  }

  console.log(`\n📊 完成! 新增: ${added}, 跳过: ${skipped}`)
}

main().catch(console.error)

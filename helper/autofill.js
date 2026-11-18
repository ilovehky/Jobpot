// Runs inside every page of the Jobpot browser window (installed by `jobpot serve`).
// Fills known application fields, outlines empty ones, and reports answers the user types so they can be reused.
// Data comes from the helper through the window.__jobpotData() binding; nothing is stored in the page.
;(() => {
  if (window.__jobpotAutofill) return
  window.__jobpotAutofill = true
  if (typeof window.__jobpotData !== 'function') return

  const SENSITIVE = /password|social security|\bssn\b|credit card|card number|\bcvv\b|bank|routing|account number|passport|driver.?s? licen/i
  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search', 'checkbox', 'range', 'color'])
  const MAX_SAVED_LENGTH = 300
  const filled = new WeakMap()
  let data = null
  let badge = null
  let lastField = null

  document.addEventListener(
    'focusin',
    (event) => {
      if (event.target instanceof Element && event.target.matches('input, textarea, select')) lastField = event.target
    },
    true,
  )

  const normalize = (text) =>
    String(text ?? '')
      .toLowerCase()
      .replace(/\(required\)|\*/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .slice(0, 200)

  function hostAllowed() {
    const host = location.hostname.replace(/^www\./, '')
    return data.hosts.some((h) => host === h || host.endsWith(`.${h}`))
  }

  function visible(el) {
    if (el.disabled || el.readOnly) return false
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || style.display === 'none') return false
    const box = el.getBoundingClientRect()
    // Sites hide some inputs as 1px boxes (e.g. a resume reader); those can't be filled by hand.
    return box.width >= 4 && box.height >= 4
  }

  function labelFor(el) {
    const byAria = el.getAttribute('aria-label')
    if (byAria) return byAria
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText ?? '')
        .join(' ')
        .trim()
      if (text) return text
    }
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (label?.innerText.trim()) return label.innerText
    }
    const wrapping = el.closest('label')
    if (wrapping?.innerText.trim()) return wrapping.innerText
    if (el.type === 'radio') {
      const legend = el.closest('fieldset')?.querySelector('legend')
      if (legend?.innerText.trim()) return legend.innerText
    }
    const container = el.closest('[class*="field" i], [class*="question" i], .form-group, li, div')
    const heading = container?.querySelector('label, legend, [class*="label" i]')
    if (heading?.innerText.trim() && heading !== el) return heading.innerText
    return el.placeholder || el.name || ''
  }

  // The question a radio group asks, rather than the label of one option.
  function groupQuestion(radio) {
    const fieldset = radio.closest('fieldset')
    const legend = fieldset?.querySelector('legend')
    if (legend?.innerText.trim()) return legend.innerText
    const group = radio.closest('[role="radiogroup"]')
    if (group?.getAttribute('aria-label')) return group.getAttribute('aria-label')
    const labelledBy = group?.getAttribute('aria-labelledby')
    if (labelledBy) return document.getElementById(labelledBy)?.innerText ?? ''
    return radio.name
  }

  function optionLabel(radio) {
    if (radio.id) {
      const label = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)
      if (label) return label.innerText
    }
    return radio.closest('label')?.innerText ?? radio.value
  }

  function standardValue(el, label) {
    const hint = normalize(`${label} ${el.name} ${el.id} ${el.getAttribute('autocomplete') ?? ''}`)
    const p = data.profile
    if (/\b(company|employer|school|university|reference|emergency|manager)\b/.test(hint)) return null
    if (/first name|given name|fname|firstname/.test(hint)) return p.firstName
    if (/last name|family name|surname|lname|lastname/.test(hint)) return p.lastName
    if (/preferred name/.test(hint)) return p.firstName
    if (/^(full )?name$|^your name$|full name|legal name/.test(normalize(label)) || el.getAttribute('autocomplete') === 'name') {
      return p.fullName
    }
    if (el.type === 'email' || /\bemail\b/.test(hint)) return p.email
    if (el.type === 'tel' || /\bphone\b|mobile|telephone/.test(hint)) return p.phone
    if (/linkedin/.test(hint)) return p.linkedinUrl
    if (/portfolio|personal website|website|personal site/.test(hint)) return p.portfolioUrl
    if (/^(current )?(location|city)$|city.*state|current location|where are you located/.test(normalize(label))) return p.location
    return null
  }

  // Self-identification questions use different option wording on every site, so match options by meaning.
  // Order matters: sponsorship questions often mention "authorization" too.
  const DECLINE = /decline|prefer not|not wish|don t wish|do not wish|choose not|not to (answer|disclose|say|self identify)|do not want to answer/
  const NO = /^no\b|\bnot\b|don t|do not/
  const SELF_ID = [
    { key: 'needsSponsorship', question: /sponsor/, options: { yes: /^yes/, no: /^no\b/ } },
    { key: 'workAuthorized', question: /(authori[sz]ed|eligible|legally (able|permitted)|right) to work|work authori[sz]ation/, options: { yes: /^yes/, no: /^no\b/ } },
    { key: 'veteran', question: /veteran|military service/, options: { yes: /veteran/, no: NO } },
    { key: 'disability', question: /disabilit/, options: { yes: /^yes|have a disability|had one/, no: NO } },
    {
      key: 'race',
      question: /\brace\b|ethnicit/,
      options: {
        hispanic: /^hispanic|^latin/,
        white: /^white/,
        black: /black|african american/,
        asian: /^asian/,
        native_american: /american indian|alaska native/,
        pacific_islander: /hawaiian|pacific islander/,
        two_or_more: /two or more|multiracial/,
      },
    },
    // Asked on its own as "Are you Hispanic or Latino?" before a separate race question.
    { key: 'race', question: /hispanic|latin[oax]/, options: { hispanic: /^yes/, other: /^no\b/ } },
    { key: 'gender', question: /\bgender\b|\bsex\b/, skip: /orientation|transgender/, options: { female: /^(female|woman)/, male: /^(male|man)\b/, nonbinary: /non ?binary/ } },
  ]

  // Returns the index of the option that matches the user's self-identification answer, or -1.
  function selfIdChoice(question, optionTexts) {
    const q = normalize(question)
    const texts = optionTexts.map(normalize)
    for (const rule of SELF_ID) {
      if (!rule.question.test(q) || rule.skip?.test(q) || !data.selfId?.[rule.key]) continue
      let value = data.selfId[rule.key]
      if (rule.options.other && value !== 'hispanic' && value !== 'decline') value = 'other'
      const pattern = rule.options[value]
      const index =
        value === 'decline'
          ? texts.findIndex((t) => DECLINE.test(t))
          : pattern
            ? texts.findIndex((t) => t && !DECLINE.test(t) && pattern.test(t) && (rule.options.no !== NO || value === 'no' || !NO.test(t)))
            : -1
      if (index >= 0) return index
    }
    return -1
  }

  function savedAnswer(label) {
    const key = normalize(label)
    if (!key) return null
    return data.answers[key] ?? null
  }

  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    for (const type of ['input', 'change', 'blur']) el.dispatchEvent(new Event(type, { bubbles: true }))
    filled.set(el, value)
  }

  function fillSelect(el, value) {
    const wanted = normalize(value)
    const option = [...el.options].find((o) => normalize(o.text) === wanted || normalize(o.value) === wanted)
    if (!option) return false
    el.value = option.value
    el.dispatchEvent(new Event('change', { bubbles: true }))
    filled.set(el, option.text)
    return true
  }

  async function fillResume(input) {
    if (input.files?.length || filled.has(input)) return false
    filled.set(input, 'pending')
    const file = await window.__jobpotResume().catch(() => null)
    if (!file) return false
    const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], file.name, { type: file.type }))
    input.files = transfer.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    filled.set(input, file.name)
    return true
  }

  function fields() {
    const scopes = [...document.querySelectorAll('form, [role="dialog"]')]
    return [...document.querySelectorAll('input, textarea, select')].filter(
      (el) =>
        !SKIP_TYPES.has(el.type) &&
        (el.type === 'file' || visible(el)) &&
        (!scopes.length || scopes.some((scope) => scope.contains(el))),
    )
  }

  // Only treat a page as an application when it asks for things like a name, email, or resume.
  function looksLikeApplication() {
    const all = fields()
    if (all.some((el) => el.type === 'file' && /resume|cv\b/i.test(`${labelFor(el)} ${el.name} ${el.id}`))) return true
    return all.filter((el) => el.type !== 'radio' && standardValue(el, labelFor(el)) != null).length >= 2
  }

  function isEmpty(el) {
    if (el.type === 'radio') return !document.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`)
    if (el.type === 'file') return !el.files?.length && filled.get(el) !== 'pending'
    if (el.tagName === 'SELECT') return !el.value || el.selectedIndex <= 0
    return !el.value.trim()
  }

  function fillAll() {
    if (!data || !hostAllowed() || !looksLikeApplication()) return
    let count = 0
    const radiosDone = new Set()
    for (const el of fields()) {
      if (filled.has(el) || !isEmpty(el)) continue
      if (el.type === 'radio') {
        if (radiosDone.has(el.name)) continue
        radiosDone.add(el.name)
        const group = [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)]
        const question = groupQuestion(el)
        const choice = selfIdChoice(question, group.map(optionLabel))
        const answer = choice >= 0 ? optionLabel(group[choice]) : savedAnswer(question)
        if (!answer) continue
        const match = choice >= 0 ? group[choice] : group.find((r) => normalize(optionLabel(r)) === normalize(answer))
        if (match) {
          match.click()
          filled.set(match, answer)
          count++
        }
        continue
      }
      const label = labelFor(el)
      if (SENSITIVE.test(label)) continue
      if (el.type === 'file') {
        if (/resume|cv\b|curriculum/i.test(`${label} ${el.name} ${el.id}`)) {
          fillResume(el).then((done) => {
            if (done) {
              data.filledCount++
              markEmpty()
            }
          })
        }
        continue
      }
      if (el.tagName === 'SELECT') {
        const choice = selfIdChoice(label, [...el.options].map((o) => o.text))
        if (choice > 0) {
          el.value = el.options[choice].value
          el.dispatchEvent(new Event('change', { bubbles: true }))
          filled.set(el, el.options[choice].text)
          count++
          continue
        }
      }
      const value = standardValue(el, label) ?? savedAnswer(label)
      if (!value) continue
      if (el.tagName === 'SELECT') {
        if (fillSelect(el, value)) count++
      } else if (!(el.tagName === 'TEXTAREA' && value.length > MAX_SAVED_LENGTH)) {
        setValue(el, value)
        count++
      }
    }
    if (count) data.filledCount += count
    markEmpty()
  }

  function emptyFields() {
    const seenRadio = new Set()
    return fields().filter((el) => {
      if (!visible(el)) return false
      if (el.type === 'radio') {
        if (seenRadio.has(el.name)) return false
        seenRadio.add(el.name)
      }
      return isEmpty(el)
    })
  }

  function markEmpty() {
    if (!looksLikeApplication()) return
    const empty = emptyFields()
    for (const el of fields()) el.style.outline = ''
    for (const el of empty) {
      el.style.outline = '3px solid #F2B035'
      el.style.outlineOffset = '2px'
    }
    if (!data.focused && empty.length) {
      const first = empty.find((el) => el.required || el.getAttribute('aria-required') === 'true') ?? empty[0]
      first.scrollIntoView({ block: 'center' })
      first.focus({ preventScroll: true })
      data.focused = true
    }
    showBadge(empty)
  }

  function showBadge(empty) {
    if (!fields().length) return
    if (!badge) {
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647'
      const root = host.attachShadow({ mode: 'closed' })
      root.innerHTML = `<style>
        .b{font:14px/1.4 system-ui,sans-serif;background:#18213D;color:#E9EEF5;border-radius:14px;padding:12px 14px;
          display:flex;gap:10px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:320px}
        button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:6px 12px;background:#F2B035;color:#18213D;cursor:pointer}
        button:focus-visible{outline:3px solid #fff;outline-offset:2px}
      </style><div class="b" role="status"><span class="t"></span><button type="button">Next empty field</button></div>`
      root.querySelector('button').addEventListener('click', () => {
        const empty = emptyFields()
        // The next empty field after the one the user was last in, wrapping to the top.
        const after =
          lastField && document.contains(lastField)
            ? empty.find((el) => el !== lastField && lastField.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
            : null
        const next = after ?? empty[0]
        if (next) {
          next.scrollIntoView({ block: 'center' })
          next.focus()
        }
      })
      document.documentElement.append(host)
      badge = { host, text: root.querySelector('.t'), button: root.querySelector('button') }
    }
    const left = empty.length
    badge.text.textContent = `Jobpot filled ${data.filledCount} ${data.filledCount === 1 ? 'field' : 'fields'}. ${left ? `${left} left to fill.` : 'All fields have answers.'}`
    badge.button.hidden = !left
  }

  // Save answers the user typed (not ones Jobpot filled) so they can be reused on later applications.
  document.addEventListener(
    'change',
    (event) => {
      const el = event.target
      if (!data || !hostAllowed() || !(el instanceof Element) || !el.matches('input, textarea, select')) return
      if (SKIP_TYPES.has(el.type) || el.type === 'file') return
      let question
      let answer
      if (el.type === 'radio') {
        if (!el.checked) return
        question = groupQuestion(el)
        answer = optionLabel(el).trim()
      } else {
        question = labelFor(el)
        answer = el.tagName === 'SELECT' ? (el.selectedOptions[0]?.text ?? '') : el.value
        answer = answer.trim()
        if (standardValue(el, question) != null) return
      }
      if (!question || !answer || answer.length > MAX_SAVED_LENGTH || SENSITIVE.test(question)) return
      if (filled.get(el) === answer) return
      window.__jobpotSave({ question: question.trim().replace(/\s+/g, ' ').slice(0, 300), answer, host: location.hostname })
      setTimeout(markEmpty, 50)
    },
    true,
  )

  let timer = 0
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(fillAll, 600)
  }

  window
    .__jobpotData()
    .then((value) => {
      if (!value) return
      data = { ...value, filledCount: 0, focused: false }
      if (!hostAllowed()) return
      fillAll()
      // Multi-step forms (LinkedIn Easy Apply, Workday) add fields later.
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })
    })
    .catch(() => {})

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule)
})()

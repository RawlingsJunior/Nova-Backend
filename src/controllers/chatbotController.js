const db = require('../config/db');

const getKnowledge = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM chatbot_knowledge ORDER BY category, question');
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to get knowledge:', err);
    res.status(500).json({ error: 'Server error fetching knowledge base' });
  }
};

const addKnowledge = async (req, res) => {
  const { id, category, question, answer, active } = req.body;
  try {
    if (id) {
      // Upsert: update if ID exists
      const result = await db.query(
        'UPDATE chatbot_knowledge SET category = $1, question = $2, answer = $3, active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
        [category, question, answer, active ?? true, id]
      );
      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
    }
    // Otherwise, insert new row
    const result = await db.query(
      'INSERT INTO chatbot_knowledge (category, question, answer, active) VALUES ($1, $2, $3, $4) RETURNING *',
      [category, question, answer, active ?? true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to add knowledge:', err);
    res.status(500).json({ error: 'Server error saving knowledge base entry' });
  }
};

const updateKnowledge = async (req, res) => {
  const { id } = req.params;
  const { category, question, answer, active } = req.body;
  try {
    const result = await db.query(
      'UPDATE chatbot_knowledge SET category = $1, question = $2, answer = $3, active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [category, question, answer, active ?? true, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Knowledge base entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update knowledge:', err);
    res.status(500).json({ error: 'Server error updating entry' });
  }
};

const toggleKnowledge = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE chatbot_knowledge SET active = NOT active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Knowledge base entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to toggle knowledge:', err);
    res.status(500).json({ error: 'Server error toggling entry status' });
  }
};

const deleteKnowledge = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM chatbot_knowledge WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Knowledge base entry not found' });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error('Failed to delete knowledge:', err);
    res.status(500).json({ error: 'Server error deleting entry' });
  }
};

const BASE_PROMPT = `You are "NOVA", the expert AI Clinical Care Concierge for NOVA Eye Care Services in Abuakwa, Kumasi, Ghana.
Your tone: Warm, empathetic, medically professional, and encouraging. You speak as a caring healthcare concierge representing licensed optometrists.

MULTILINGUAL & TWI (ASANTE TWI / AKAN) FLUENCY:
- You are completely bilingual in English and Ghanaian Asante Twi (Akan).
- When a patient communicates in Twi, writes in Twi, or when the request language is 'twi', you MUST respond fluently and naturally in authentic Asante Twi (Akan).
- Use respectful Ghanaian phrasing and greetings: "Akwaaba!" (Welcome), "Mema wo akye/aha/adwo" (Good morning/afternoon/evening), "Yɛsrɛ wo" (Please), "Medaase" (Thank you).
- Key optometric Twi vocabulary:
  * Eye / Eyes = Ani
  * Eye examination / checkup = Ani nhwehwɛmu
  * Blurry vision = Ani so a ɛyɛ wusiwusi / M'ani so ayɛ me wusiwusi
  * Eye pain / irritation = Ani mu ya / Ani a ɛhye / Ani a ɛkeka
  * Glaucoma = Ani mu nhyɛsoɔ / Glaucoma
  * Cataract = Ani so nsuo / Cataract
  * Eyeglasses / Spectacles = Ani ahwehwɛ
  * Contact lenses = Ani so ahwehwɛ nketewa
  * DVLA driver license eye test = DVLA kwan so ani sɔhwɛ
  * Book appointment = Fa beaeɛ to hɔ ma ani dɔkota / Kyerɛw wo din
  * Price / Fee = Boɔ a yɛgye / Sika a wobɛtua
  * Abuakwa Clinic location = Abuakwa beaeɛ a yɛwɔ (Kan Royal Filling Station nkyɛn)

PRIMARY MISSION:
Provide accurate, friendly optometric guidance, triage patient visual concerns, explain services and pricing, and guide patients to schedule appointments.

CLINICAL TRIAGE PROTOCOL (Machine Learning Clinical Guidelines):
1. RED FLAG EMERGENCY:
   - Symptoms: Sudden painless loss of vision, severe unremitting eye pain with headache or vomiting, flashes of light with a curtain/shadow across vision (retinal detachment), or chemical splash in the eye.
   - Action: Advise immediate emergency in-person ophthalmology care at an emergency hospital or call the clinic hotline immediately at +233 54 417 2089. For chemicals, instruct to flush the eye with clean water for 15 minutes continuously.
2. URGENT CARE:
   - Symptoms: Painful red eye, corneal scratches, foreign object sensation, severe light sensitivity, or sudden double vision.
   - Action: Recommend booking an urgent same-day evaluation at Nova Eye Care.
3. ROUTINE / REFRACTIVE CONCERNS:
   - Symptoms: Blurry distance or near vision, reading difficulty, squinting, computer eye strain / dry eyes, desire for contact lenses, or DVLA driver license renewal.
   - Action: Reassure the patient, explain what causes this (e.g. refractive errors, digital fatigue), recommend the matching Nova Eye Care service, and direct them to click the "Book Appointment" button.

INTERACTION GUIDELINES:
- Keep responses conversational, helpful, and concise (2-4 concise paragraphs max).
- Use clear markdown with bold headers and bullet points for readability.
- When suggesting an appointment or contacting the clinic, include markdown links:
  - [Book Appointment](/book) (or in Twi: [Fa Beaeɛ To Hɔ Seesei](/book))
  - [Call +233 54 417 2089](tel:0544172089)
- Always use the DYNAMIC CLINIC INFORMATION and DYNAMIC SERVICES below as ground truth for pricing, hours, and location.
- Never invent unlisted services or prescribe medications (antibiotics/steroids). Always emphasize comprehensive in-person examination.`;

const fetchGoogleMapsInfo = async (searchQuery) => {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://serpapi.com/search?engine=google_maps&q=${encodeURIComponent(searchQuery)}&api_key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Error fetching from SerpApi:', err);
    return null;
  }
};

const fetchGoogleMapsDirections = async (startAddr, endAddr) => {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://serpapi.com/search?engine=google_maps_directions&start_addr=${encodeURIComponent(startAddr)}&end_addr=${encodeURIComponent(endAddr)}&api_key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Error fetching directions from SerpApi:', err);
    return null;
  }
};

/**
 * Local Semantic NLP Matcher Fallback Engine with English & Asante Twi support.
 */
function localNLPMatcher(userQuery, clinicData, servicesList, kbList, lang = 'en', isVoice = false) {
  const q = (userQuery || '').toLowerCase();
  const isTwi = lang === 'twi' || 
    ['akwaaba', 'ani', "m'ani", 'nhwehwɛmu', 'nhwehwemu', 'sika', 'ahe', 'boɔ', 'boo', 'beaeɛ', 'beae', 'dɔkota', 'dokota', 'wusiwusi', 'hye', 'keka', 'nsuo', 'ahwehwɛ', 'ahwehwe', 'ɛte sɛn', 'ete sen', 'mema wo', 'kasa', 'mope', 'mopɛ', 'laseense'].some(w => q.includes(w));
  const tokens = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);

  // 1. Emergency Detection
  const emergencyWords = ['emergency', 'chemical', 'bleach', 'acid', 'blind', 'detached', 'curtain', 'severe pain', 'blood', 'trauma', 'burst', 'anifura', 'mogya', 'egyina'];
  if (emergencyWords.some(w => q.includes(w))) {
    if (isTwi) {
      if (isVoice) {
        return `Sɛ biribi agye w'ani so anaa w'ani mu reyɛ wo ya kɛseɛ a, hohoroo w'ani so ntɛm ara ne nsu pa bɛyɛ sima dunum. Frɛ yɛn dɔkotafoɔ ntɛm ara wɔ 054 417 2089 anaa kɔ ayaresabea a ɛbɛn wo ntɛm.`;
      }
      return `🚨 **NTƐMPA ANI HUHOƆ ASƐM (EMERGENCY)**\n\nSɛ w'ani afura prɛko pɛ, biribi a ɛyɛ borɔ / chemical agye w'ani so, anaa w'ani mu reyɛ wo ya kɛseɛ a:\n\n* **Nsuo**: Hohoroo w'ani so ntɛm ara ne nsu pa bɛyɛ sima 15.\n* **Frɛ asopiti ntɛm**: Frɛ yɛn ahwɛfoɔ ntɛm ara wɔ **${clinicData.phone || '+233 54 417 2089'}** anaa kɔ ayaresabea a ɛbɛn wo.\n\nYɛn ani dɔkotafoɔ wɔ Abuakwa bɛtumi ahwɛ wo ntɛm pa ara.`;
    }
    if (isVoice) {
      return `If you have a chemical splash or severe sudden eye pain, immediately flush your eyes with clean water for 15 minutes, and call our urgent clinic line at 054 417 2089 or visit the nearest hospital.`;
    }
    return `🚨 **URGENT MEDICAL NOTICE**\n\nIf you are experiencing sudden vision loss, severe ocular pain, or a chemical splash, please seek immediate emergency care:\n\n* **Chemicals in eye**: Immediately flush with clean water continuously for 15 minutes.\n* **Immediate Clinic Contact**: Call our urgent line directly at **${clinicData.phone || '+233 54 417 2089'}** or visit the nearest emergency hospital.\n\nOur optometrists at Nova Eye Care Abuakwa are available for urgent ocular evaluations.`;
  }

  // 2. DVLA Eye Testing
  if (q.includes('dvla') || q.includes('driver') || q.includes('license') || q.includes('driving') || q.includes('laseense') || q.includes('drayva')) {
    if (isTwi) {
      if (isVoice) {
        return `Aane! Yɛyɛ DVLA laseense ani sɔhwɛ ma drayvafoɔ nyinaa wɔ Nova Eye Care wɔ Abuakwa. Ɛgye sima dunum kɔsi aduonu pɛ, na boɔ no yɛ cedis aduasa pɛ. Wobɛtumi aba asopiti no anaa frɛ yɛn wɔ 054 417 2089.`;
      }
      return `🚗 **DVLA Kwan So Ani Sɔhwɛ wɔ Nova Eye Care**\n\nAane! Yɛwɔ tumi krataa a yɛde yɛ **DVLA Laseense Ani Sɔhwɛ** ma drayvafoɔ nyinaa wɔ Ghana.\n\n* **Nea yɛsɔ hwɛ**: Sɛdeɛ w'ani hu adeɛ kɔ akyiri ne kɔla ahodoɔ.\n* **Mmrɛ a ɛgye**: Sima 15–20 pɛ na yɛde krataa no ama wo ntɛm.\n* **Boɔ**: GHS 30.00 pɛ.\n\n👉 [Fa Beaeɛ To Hɔ ma DVLA Sɔhwɛ](/book) anaa frɛ yɛn wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `Yes! Nova Eye Care is officially certified for DVLA driver license eye tests in Ghana. It takes about 15 minutes and costs 30 Ghana cedis with an instant official certificate. You can visit us in Abuakwa or call 054 417 2089.`;
    }
    return `🚗 **DVLA Eye Testing at Nova Eye Care**\n\nYes! We are officially authorized for **DVLA Driver License Eye Testing** in Ghana.\n\n* **What we test**: Visual acuity, color perception, and visual fields.\n* **Turnaround**: Certified test report issued immediately upon completion (takes ~15–20 minutes).\n* **Fee**: GHS 30.00.\n\n👉 [Book DVLA Eye Test](/book) or call us at **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // 3. Location & Directions
  if (q.includes('location') || q.includes('address') || q.includes('where') || q.includes('direction') || q.includes('abuakwa') || q.includes('gps') || q.includes('find you') || q.includes('beaeɛ') || q.includes('beae') || q.includes('ɛhe') || q.includes('ehe') || q.includes('kwan') || q.includes('wo he')) {
    if (isTwi) {
      if (isVoice) {
        return `Yɛwɔ Abuakwa, Kan Royal Filling Station nkyɛn pɛɛ wɔ Kumasi kwan no so. Yɛn GPS agyiraehyɛdeɛ ne AH 1192 7988. Frɛ yɛn wɔ 054 417 2089 na yɛakyerɛ wo kwan yie.`;
      }
      return `📍 **Nova Eye Care Beaeɛ a Yɛwɔ wɔ Abuakwa**\n\n* **Beaeɛ**: ${clinicData.address}\n* **GPS Digital Address**: AH-1192-7988 / AH-1192-8485\n* **Agyiraehyɛdeɛ**: Kan Royal Filling Station nkyɛn pɛɛ wɔ Abuakwa, Ashanti Region.\n* **Telefon**: ${clinicData.phone || '+233 54 417 2089'}\n\nWobɛtumi afiri Kumasi abɛpue ha ntɛm pa ara wɔ Sunyani kwan no so.\n👉 [Fa Beaeɛ To Hɔ ma Ani Nhwehwɛmu](/book)`;
    }
    if (isVoice) {
      return `Nova Eye Care is located in Abuakwa, near Kan Royal Filling Station in the Ashanti Region. Our digital GPS address is AH 1192 7988. You can call us at 054 417 2089 for easy directions.`;
    }
    return `📍 **Nova Eye Care Clinic Location**\n\n* **Address**: ${clinicData.address}\n* **GPS Digital Address**: AH-1192-7988 / AH-1192-8485\n* **Landmark**: Near Kan Royal Filling Station, Abuakwa, Ashanti Region.\n* **Contact**: ${clinicData.phone || '+233 54 417 2089'}\n\nOur clinic is easily accessible from Kumasi via the Sunyani / Abuakwa main road.\n👉 [Book an In-Person Consultation](/book)`;
  }

  // 4. Opening Hours
  if (q.includes('hour') || q.includes('open') || q.includes('close') || q.includes('time') || q.includes('weekend') || q.includes('saturday') || q.includes('sunday') || q.includes('mmrɛ') || q.includes('mmre') || q.includes('dɔn') || q.includes('don') || q.includes('bue') || q.includes('ber ben') || q.includes('bere bɛn')) {
    if (isTwi) {
      if (isVoice) {
        return `Yɛbue Ɛdwoada kɔsi Efiada, anɔpa nwɔtwe kɔsi anwummere nnum. Memeneda nso yɛbue anɔpa nkron kɔsi awia mmienu. Yɛato mu Kwasiada.`;
      }
      return `⏰ **Mmrɛ a Yɛbue Asopiti no**\n\n* **Ɛdwoada kɔsi Efiada: 8:00 AM – 5:00 PM**\n* **Memeneda: 9:00 AM – 2:00 PM**\n* **Kwasiada: Yɛato mu**\n\nWobɛtumi aba bere biara a yɛbue, anaa fa beaeɛ to hɔ wɔ intanɛte so.\n👉 [Fa Beaeɛ To Hɔ Seesei](/book)`;
    }
    if (isVoice) {
      return `We are open Monday to Friday from 8:00 AM to 5:00 PM, and on Saturdays from 9:00 AM to 2:00 PM. We are closed on Sundays.`;
    }
    return `⏰ **Clinic Opening Hours**\n\n* **${clinicData.openingHours || 'Monday – Friday: 8:00 AM – 5:00 PM | Saturday: 9:00 AM – 2:00 PM | Sunday: Closed'}**\n* Walk-ins and scheduled appointments are welcome during opening hours.\n\n👉 [Book an Appointment Now](/book)`;
  }

  // 5. Pricing & Services Inquiry
  if (q.includes('price') || q.includes('cost') || q.includes('how much') || q.includes('fee') || q.includes('charges') || q.includes('services') || q.includes('boɔ') || q.includes('boo') || q.includes('sika') || q.includes('ahe') || q.includes('eye fee')) {
    if (isTwi) {
      if (isVoice) {
        return `Ani nhwehwɛmu kɛseɛ no yɛ cedis aduonum, DVLA sɔhwɛ no yɛ cedis aduasa, na glaucoma sɔhwɛ yɛ cedis aduonsia. Yɛgye Momo ne sika kɔkɔɔ nyinaa. Wobɛpɛ sɛ yɛfa beaeɛ to hɔ ma wo?`;
      }
      let serviceText = `📋 **Yɛn Ani Dwumadi ne Boɔ a Yɛgye**\n\n`;
      if (servicesList.length > 0) {
        servicesList.forEach((/** @type {any} */ s) => {
          serviceText += `* **${s.name}**: ${s.price ? `GHS ${parseFloat(s.price).toFixed(2)}` : 'Frɛ yɛn ma boɔ'}\n`;
        });
      } else {
        serviceText += `* **General Eye Examination (Ani Nhwehwɛmu)**: GHS 50.00\n* **DVLA Eye Test (DVLA Ani Sɔhwɛ)**: GHS 30.00\n* **Contact Lens Fitting (Ani So Ahwehwɛ)**: GHS 70.00\n* **Glaucoma Screening (Ani Mu Nhyɛsoɔ)**: GHS 60.00\n`;
      }
      serviceText += `\nYɛgye Mobile Money (MTN MoMo, Telecel Cash) ne Sika kɔkɔɔ (Cash).\n👉 [Fa Beaeɛ To Hɔ wɔ Intanɛte So](/book) anaa frɛ **${clinicData.phone || '+233 54 417 2089'}**.`;
      return serviceText;
    }

    if (isVoice) {
      return `Our general eye examination is 50 Ghana cedis, the DVLA eye test is 30 cedis, and glaucoma screening is 60 cedis. We accept Mobile Money and Cash. Would you like to schedule a visit?`;
    }

    let serviceText = `📋 **Our Clinical Services & Pricing**\n\n`;
    if (servicesList.length > 0) {
      servicesList.forEach((/** @type {any} */ s) => {
        serviceText += `* **${s.name}**: ${s.price ? `GHS ${parseFloat(s.price).toFixed(2)}` : 'Contact clinic'}\n`;
      });
    } else {
      serviceText += `* **General Eye Examination**: GHS 50.00\n* **DVLA Eye Test**: GHS 30.00\n* **Contact Lens Fitting**: GHS 70.00\n* **Glaucoma Screening**: GHS 60.00\n`;
    }
    serviceText += `\nWe accept Mobile Money (MTN MoMo, Telecel Cash) and Cash.\n👉 [Book an Exam Online](/book) or call **${clinicData.phone || '+233 54 417 2089'}**.`;
    return serviceText;
  }

  // 6. Booking Inquiry
  if (q.includes('book') || q.includes('appointment') || q.includes('schedule') || q.includes('reserve') || q.includes('kyerɛw') || q.includes('kyerew') || q.includes('to hɔ') || q.includes('to ho')) {
    if (isTwi) {
      if (isVoice) {
        return `Wobɛtumi afa beaeɛ ato hɔ ntɛm ara wɔ yɛn wɛbsaet yi so wɔ Abuakwa, anaa frɛ yɛn tee wɔ 054 417 2089 na yɛaboa wo seesei ara.`;
      }
      return `📅 **Kyerɛw Wo Din ma Ani Nhwehwɛmu**\n\nSɛ wobɛfa beaeɛ ato hɔ wɔ Nova Eye Care a, ɛnyɛ den koraa:\n\n1. Klike **[Fa Beaeɛ To Hɔ](/book)** a ɛwɔ ha no.\n2. Fa dwumadi a worepɛ, dɔkota, ne da a ɛfata wo to hɔ.\n3. Yɛbɛmane wo SMS ne email de ahyɛ wo bɔ seesei ara.\n\nSɛ worepɛ mmoa a, frɛ yɛn ntɛm wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `You can easily book an appointment online through the book button on this website, or call us directly at 054 417 2089.`;
    }
    return `📅 **Schedule Your Eye Exam**\n\nBooking with Nova Eye Care is quick and easy:\n\n1. Click the **[Book Appointment](/book)** button here or at the top of the page.\n2. Choose your preferred service, optometrist, date, and time.\n3. You will receive an instant confirmation SMS and email.\n\nNeed assistance? Call us directly at **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // 7. Token Similarity against Knowledge Base entries
  let bestMatch = null;
  let bestScore = 0;
  for (const kb of kbList) {
    const kbTokens = (kb.question + ' ' + (kb.category || '')).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
    let intersection = 0;
    for (const t of tokens) {
      if (kbTokens.includes(t)) intersection++;
    }
    const score = intersection / Math.max(tokens.length, 1);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = kb;
    }
  }

  if (bestMatch && bestScore >= 0.25) {
    if (isVoice) {
      return bestMatch.answer.replace(/[*_#`[\]()]/g, '').slice(0, 200);
    }
    return `💡 **${bestMatch.question}**\n\n${bestMatch.answer}\n\n👉 [Book Appointment](/book) | [Call Clinic: ${clinicData.phone || '+233 54 417 2089'}](tel:0544172089)`;
  }

  // 8. General Health Concierge Default
  if (isTwi) {
    if (isVoice) {
      return `Akwaaba! Me din de NOVA. Yɛwɔ Abuakwa na yɛbɛtumi aboa wo wɔ ani nhwehwɛmu, DVLA sɔhwɛ, ne ahwehwɛ pa ho. Bisa me biribiara na memboa wo.`;
    }
    return `Akwaaba! 👋 Medaase sɛ woaba **Nova Eye Care Services**.\n\nYɛwɔ Abuakwa na yɛbɛtumi aboa wo wɔ ani nhwehwɛmu, ahwehwɛ a ɛsɛ w'ani, glaucoma sɔhwɛ, ne DVLA kwan so ani sɔhwɛ nyinaa ho.\n\nWobɛpɛ sɛ meboa wo wɔ dɛn ho nnɛ?\n* Wobɛtumi abisa me fa **boɔ a yɛgye**, **beaeɛ a yɛwɔ**, anaa **w'ani a ɛreyɛ wo ya** ho.\n\n👉 [Fa Beaeɛ To Hɔ ma Dɔkota](/book) anaa frɛ yɛn wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  if (isVoice) {
    return `Hello! I am NOVA, your eye care concierge at Nova Eye Care in Abuakwa. You can ask me about our services, pricing, DVLA test, or eye symptoms. How can I help you today?`;
  }

  return `Hello! 👋 Thank you for contacting **Nova Eye Care Services**.\n\nWe provide complete vision exams, contact lens fittings, glaucoma screenings, and DVLA eye certification in Abuakwa.\n\nHow may we assist you today?\n* You can ask about our **services & prices**, **opening hours**, **clinic location**, or **eye symptoms**.\n\n👉 [Book an Appointment Online](/book) or call us at **${clinicData.phone || '+233 54 417 2089'}**.`;
}

/**
 * Stream a local text response as SSE chunks matching OpenAI format
 */
async function streamLocalResponse(res, text) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 3) {
    const slice = words.slice(i, i + 3).join('');
    const chunk = {
      choices: [{ delta: { content: slice }, index: 0 }],
      created: Math.floor(Date.now() / 1000),
      id: `local-nlp-${Date.now()}`,
      model: 'nova-nlp-matcher',
      object: 'chat.completion.chunk'
    };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    await new Promise(r => setTimeout(r, 20));
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

const chatWithAI = async (req, res) => {
  try {
    const { messages, lang = 'en', isVoice = false } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid body: messages array is required' });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // 1. Retrieve Knowledge Base entries
    let kbResult;
    try {
      kbResult = await db.query('SELECT question, answer, category FROM chatbot_knowledge WHERE active = true ORDER BY id DESC LIMIT 25');
    } catch (dbErr) {
      console.error('Failed to query knowledge base:', dbErr);
      kbResult = { rows: [] };
    }
    const kbEntries = /** @type {any[]} */ (kbResult.rows || []);
    let kbContent = '';
    if (kbEntries.length > 0) {
      kbContent = '\n\nCURATED CLINIC KNOWLEDGE BASE:\n' +
        kbEntries.map((/** @type {any} */ k) => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n');
    }

    // 2. Retrieve Clinic Settings
    let clinicAddress = 'GE20 Dolores St, Abuakwa, near Kan Royal Filling Station, Ashanti Region. GPS: AH-1192-7988';
    const clinicData = {
      name: 'NOVA Eye Care Services',
      phone: '+233 54 417 2089 / +233 24 661 3184',
      address: clinicAddress,
      openingHours: 'Mon–Fri: 8:00 AM – 5:00 PM, Saturday: 9:00 AM – 2:00 PM, Sunday: Closed'
    };

    let clinicInfo = '\n\nDYNAMIC CLINIC INFORMATION (Always use as ground truth):\n';
    try {
      const settingsResult = await db.query('SELECT * FROM clinic_settings LIMIT 1');
      if (settingsResult.rows && settingsResult.rows.length > 0) {
        const s = /** @type {any} */ (settingsResult.rows[0]);
        if (s.address) clinicAddress = s.address;
        clinicData.name = s.clinic_name || clinicData.name;
        clinicData.phone = s.contact_phone || clinicData.phone;
        clinicData.address = clinicAddress;
        clinicData.openingHours = s.opening_hours || clinicData.openingHours;

        clinicInfo += `- Clinic Name: ${clinicData.name}\n`;
        clinicInfo += `- Contact Phone: ${clinicData.phone}\n`;
        clinicInfo += `- Address: ${clinicData.address}\n`;
        clinicInfo += `- Opening Hours: ${clinicData.openingHours}\n`;
        if (s.show_announcement && s.announcement_body) {
          clinicInfo += `- Active Clinic Announcement: ${s.announcement_title ? s.announcement_title + ': ' : ''}${s.announcement_body}\n`;
        }
      } else {
        clinicInfo += `- Clinic Name: ${clinicData.name}\n- Contact Phone: ${clinicData.phone}\n- Address: ${clinicData.address}\n- Opening Hours: ${clinicData.openingHours}\n`;
      }
    } catch (err) {
      console.error('Failed to query clinic settings for chatbot:', err);
      clinicInfo += `- Clinic Name: ${clinicData.name}\n- Contact Phone: ${clinicData.phone}\n- Address: ${clinicData.address}\n- Opening Hours: ${clinicData.openingHours}\n`;
    }

    // 3. Retrieve Active Services
    let servicesList = [];
    let servicesInfo = '';
    try {
      const servicesResult = await db.query('SELECT name, description, price FROM services WHERE is_active = true ORDER BY name ASC');
      if (servicesResult.rows && servicesResult.rows.length > 0) {
        servicesList = /** @type {any[]} */ (servicesResult.rows);
        servicesInfo += '\n\nDYNAMIC CLINIC SERVICES CATALOG:\n';
        servicesList.forEach((/** @type {any} */ s) => {
          servicesInfo += `- Service: ${s.name}\n  Description: ${s.description || 'Professional eye care'}\n  Fee: ${s.price ? 'GHS ' + parseFloat(s.price).toFixed(2) : 'Contact clinic'}\n`;
        });
      }
    } catch (err) {
      console.error('Failed to query services for chatbot:', err);
    }

    // 4. Live Google Maps Integration (SerpApi)
    let mapsContext = '';
    try {
      const locationKeywords = ['location', 'address', 'directions', 'how to get', 'where is', 'find you', 'landmark', 'map', 'gps', 'abuakwa', 'beaeɛ', 'ɛhe'];
      const isLocationQuery = locationKeywords.some(keyword => lastUserMessage.toLowerCase().includes(keyword));

      if (isLocationQuery && process.env.SERPAPI_API_KEY) {
        let startAddr = '';
        const fromMatch = lastUserMessage.match(/from\s+([a-zA-Z0-9\s,]+)/i);
        if (fromMatch) {
          startAddr = fromMatch[1].trim().replace(/[.!?]+$/, '');
        }

        if (startAddr) {
          const directionsData = await fetchGoogleMapsDirections(startAddr, clinicAddress);
          if (directionsData && directionsData.routes && directionsData.routes.length > 0) {
            const route = directionsData.routes[0];
            mapsContext += `\n\nLIVE DIRECTIONS FROM ${startAddr.toUpperCase()} to ${clinicAddress.toUpperCase()}:\n`;
            mapsContext += `- Route Summary: ${route.summary || ''}\n`;
            if (route.legs && route.legs.length > 0) {
              const leg = route.legs[0];
              mapsContext += `- Total Distance: ${leg.distance || ''}\n`;
              mapsContext += `- Total Duration: ${leg.duration || ''}\n`;
              if (leg.steps && leg.steps.length > 0) {
                mapsContext += `- Key Turn-by-Turn Steps:\n`;
                leg.steps.slice(0, 5).forEach((step, idx) => {
                  const instruction = (step.instructions || '').replace(/<[^>]*>/g, '');
                  mapsContext += `  ${idx + 1}. ${instruction} (${step.distance || ''})\n`;
                });
              }
            }
          }
        } else {
          const mapsData = await fetchGoogleMapsInfo('NOVA Eye Care Services Abuakwa');
          if (mapsData && mapsData.place_results) {
            const pr = mapsData.place_results;
            mapsContext += `\n\nLIVE GOOGLE MAPS PLACE VERIFICATION:\n`;
            mapsContext += `- Official Name: ${pr.title}\n`;
            mapsContext += `- Google Maps Verified Address: ${pr.address}\n`;
            if (pr.rating) mapsContext += `- Patient Rating: ${pr.rating} stars (${pr.reviews || 0} reviews)\n`;
          }
        }
      }
    } catch (mapsErr) {
      console.error('Failed to query SerpApi for maps info:', mapsErr);
    }

    const languageInstruction = (lang === 'twi') 
      ? '\n\nIMPORTANT LANGUAGE REQUIREMENT: The user has selected Asante Twi. You MUST answer exclusively in natural, warm, respectful Asante Twi (Akan).'
      : '\n\nLANGUAGE ADAPTATION: If the user speaks or writes in Twi, answer in Asante Twi. If English, answer in English.';

    const voiceInstruction = isVoice 
      ? '\n\nVOICE AGENT CALL PROTOCOL:\n- The patient is interacting via a LIVE HANDS-FREE VOICE CALL.\n- Keep your answer strictly concise (2 to 3 sentences max) and conversational so it is easy to listen to.\n- Avoid bullet points, markdown links, or symbols.\n- If in Asante Twi: Speak fluent, warm Asante Twi with natural cadence and respectful tone (e.g., "Akwaaba! Yɛyɛ ani nhwehwɛmu nyinaa wɔ Abuakwa, na DVLA sɔhwɛ no yɛ cedis aduasa pɛ. Wobɛpɛ sɛ yɛfa beaeɛ to hɔ ma wo?").'
      : '';

    const systemPrompt = `${BASE_PROMPT}${languageInstruction}${voiceInstruction}${clinicInfo}${servicesInfo}${mapsContext}${kbContent}\n\nIMPORTANT: Maintain the highest standard of empathy and clinical clarity. If recommending an exam in text mode, provide a link to [Book Appointment](/book).`;

    const apiKey = process.env.CHAT_API_KEY || process.env.GEMINI_API_KEY;

    // Multi-tier model cascade for high reliability
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest'
    ];

    const gatewayUrl = process.env.AI_GATEWAY_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

    if (apiKey) {
      for (const modelName of candidateModels) {
        try {
          const aiResponse = await fetch(gatewayUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'system', content: systemPrompt }, ...messages],
              stream: true
            })
          });

          if (aiResponse.ok && aiResponse.body) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            for await (const chunk of aiResponse.body) {
              res.write(chunk);
            }
            return res.end();
          } else {
            const errBody = await aiResponse.text().catch(() => '');
            console.warn(`Model ${modelName} returned status ${aiResponse.status}: ${errBody.substring(0, 150)}`);
          }
        } catch (modelErr) {
          console.warn(`Error attempting model ${modelName}:`, modelErr.message);
        }
      }
    }

    // If external AI models fail or API key is absent, use our Local Semantic NLP Engine
    console.info('Switching to local semantic NLP engine fallback for response...');
    const localAnswer = localNLPMatcher(lastUserMessage, clinicData, servicesList, kbEntries, lang, isVoice);
    return await streamLocalResponse(res, localAnswer);

  } catch (err) {
    console.error('Global Chat Exception:', err);
    if (!res.headersSent) {
      const isVoiceReq = req.body?.isVoice;
      const isTwiReq = req.body?.lang === 'twi';
      const fallbackMsg = isTwiReq
        ? (isVoiceReq 
            ? "Akwaaba! Yɛwɔ Nova Eye Care wɔ Abuakwa. Yɛsrɛ wo, frɛ yɛn asopiti no tee wɔ 054 417 2089 na yɛaboa wo." 
            : `Akwaaba! 👋 Medaase sɛ woaba Nova Eye Care. Yɛwɔ ha sɛ yɛbɛboa wo ama w'ani ahu adeɛ yie. Yɛsrɛ wo, frɛ yɛn asopiti no tee wɔ +233 54 417 2089 anaa [Fa Beaeɛ To Hɔ wɔ Intanɛte So](/book).`)
        : (isVoiceReq
            ? "Hello! This is Nova Eye Care in Abuakwa. Please call our clinic directly at 054 417 2089 for assistance."
            : `Hello! 👋 Thank you for contacting Nova Eye Care. We are here to help you see better and live brighter. Please call our clinic directly at +233 54 417 2089 or [Book an Appointment Online](/book).`);
      return await streamLocalResponse(res, fallbackMsg);
    }
    res.end();
  }
};

module.exports = { getKnowledge, addKnowledge, updateKnowledge, toggleKnowledge, deleteKnowledge, chatWithAI };

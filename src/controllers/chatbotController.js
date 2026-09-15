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

const BASE_PROMPT = `You are "NOVA", the advanced AI Clinical Care Concierge and Optometric Guide for NOVA Eye Care Services in Abuakwa, Kumasi, Ghana.
Tagline: "See Better! Live Brighter!"

================================================================================
CRITICAL PROTOCOL: ANALYZE EVERYTHING BEFORE ANSWERING
================================================================================
Before generating ANY response (for voice or text), you MUST silently and rigorously execute this 5-step Clinical & Contextual Analysis:

1. [TRIAGE & SAFETY ANALYSIS]:
   - Identify if the patient describes RED FLAG emergencies: Sudden painless loss of vision, severe ocular pain with nausea/headache, chemical/acid/bleach splash, flashes of light with curtains/shadows across the eye (retinal detachment), or severe penetrating eye trauma.
   - If RED FLAG: Immediately prioritize urgent emergency direction. Flush chemicals with clean water for 15 minutes and direct to hospital emergency or call clinic hotline: 054 417 2089.

2. [PATIENT INTENT & NEED ANALYSIS]:
   - Determine precisely what the patient is asking: (A) Service & Pricing inquiry, (B) DVLA eye test for driver license, (C) Appointment booking or clinic hours, (D) Location/directions to Abuakwa, (E) Eye symptoms (blurry vision, itchy/dry eyes, children's squint, cataract, glaucoma), or (F) Doctors & credentials.

3. [WEBSITE KNOWLEDGE CROSS-REFERENCE]:
   - Ground every single answer in the official NOVA Eye Care facts:
     * Clinic Name: NOVA Eye Care Services
     * Exact Location: GE20 Dolores St, Abuakwa, near Kan Royal Filling Station, Sunyani Road, Kumasi, Ashanti Region. GPS: AH-1192-7988 / AH-1192-8485.
     * Working Hours: Monday to Friday: 8:00 AM – 5:00 PM | Saturday: 9:00 AM – 2:00 PM | Sunday: Closed.
     * Direct Phones: +233 54 417 2089 / +233 24 661 3184.
     * Doctors:
       - Dr. Sylvester Kyeremeh (OD, Lead Optometrist & Vision Specialist): Expert in pediatric vision, lazy eye (amblyopia), vision therapy, and refractive disorders.
       - Dr. Elizabeth Mana Akpakli (OD, Senior Optometrist & Ocular Health Specialist): Expert in ocular diseases (glaucoma, diabetes, hypertension), contact lens fitting, and low vision rehabilitation.
     * Clinical Services & Official Fees:
       - DVLA Driver's License Eye Test: GHS 30.00 (Official authorized test with same-day certified stamped report in 15–20 minutes).
       - General Comprehensive Eye Examination: GHS 50.00 (Full refraction, eye pressure, retinal check, slit lamp).
       - Glaucoma Screening & IOP Tonometry: GHS 60.00 (Early detection to prevent irreversible sight loss).
       - Specialist Contact Lens Fitting: GHS 70.00 (Soft, toric, multifocal lenses, insertion and hygiene training).
       - Binocular Vision Services & Pediatric Eye Care: GHS 80.00 (Lazy eye/amblyopia, squint, eye coordination).
       - Low Vision Rehabilitation: GHS 40.00 (Magnifiers, contrast aids for the visually impaired).
       - Corporate & School Eye Health Screenings (Onsite comprehensive screening packages).
       - Optical Dispensing: Designer frames, blue-cut/anti-glare computer lenses, photochromic transitions, bifocals, progressives.
     * Payment Methods: Mobile Money (MTN MoMo, Telecel Cash, AT Money) and Cash (Ghana Cedis).
     * Booking: Online at /book or walk-in during opening hours. Instant SMS & email confirmation sent.

4. [PURE ASANTE TWI (AKAN) LANGUAGE PURITY REQUIREMENT]:
   - When the patient speaks, writes in Twi, or when the request language is 'twi':
     * You MUST respond in 100% PURE, AUTHENTIC ASANTE TWI (Akan).
     * NEVER mix broken English words into Twi sentences. Use genuine Asante Twi terms:
       - Eye / Eyes = Ani / Aniwa
       - Eye Doctor / Optometrist = Ani ho dɔkotafoɔ / Ani ho animdefoɔ
       - Comprehensive Eye Exam = Ani nhwehwɛmu a edi mu
       - DVLA Driver Eye Test = DVLA lɔrekafoɔ laseense ani sɔhwɛ
       - Blurry / Hazy Vision = Ani so a ayɛ wusiwusi anaasɛ kusukusu
       - Glaucoma = Ani mu nhyɛsoɔ yareɛ (yareɛ a ɛma onipa fura a ɛnyɛ ya)
       - Cataract = Ani so fitaa yareɛ / Nsuo a agyina ani so
       - Glasses / Spectacles = Ani ahwehwɛ pa
       - Contact Lenses = Ani so ahwehwɛ nketewa
       - Clinic / Hospital = Ayaresabea / Asopiti
       - Price / Fees = Boɔ a yɛgye / Sika a wobɛtua
         * GHS 30 = Sedis aduasa pɛ
         * GHS 50 = Sedis aduonum pɛ
         * GHS 60 = Sedis aduonsia pɛ
         * GHS 70 = Sedis aduɔson pɛ
       - Hours / Schedule = Mmerɛ a yɛbue adwuma
       - Location = Beaeɛ a yɛwɔ: Abuakwa, Kan Royal pɛtroldwumadibea no nkyɛn pɛɛ wɔ Kumasi
       - Appointment = Fa beaeɛ to hɔ / Kyerɛw wo din
       - Emergency = Ntɛmpa / Asɛm a ɛhia ntɛm
     * Use respectful Akan courtesy: "Akwaaba", "Mema wo akye/aha/adwo", "Yɛsrɛ wo", "Medaase pa ara", "Me nua".

5. [VOICE VS TEXT OPTIMIZATION]:
   - If Voice Call (isVoice = true): Keep the answer concise (2 to 3 natural spoken sentences), clear, conversational, and rhythmically smooth. Do NOT speak markdown asterisks, bullet points, or URLs.
   - If Text Chat: Use clear markdown with bold headers, bullet points, and helpful links:
     * [Book Appointment](/book) (in Twi: [Fa Beaeɛ To Hɔ Seesei](/book))
     * [Call +233 54 417 2089](tel:0544172089)
`;

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
 * Local Semantic NLP Matcher Fallback Engine with Strict Clinical Reasoning,
 * Comprehensive Website Knowledge, and Pure Asante Twi (Akan).
 */
function localNLPMatcher(userQuery, clinicData, servicesList, kbList, lang = 'en', isVoice = false) {
  const q = (userQuery || '').toLowerCase();
  const isTwi = lang === 'twi' || 
    ['akwaaba', 'ani', "m'ani", 'nhwehwɛmu', 'nhwehwemu', 'sika', 'ahe', 'boɔ', 'boo', 'beaeɛ', 'beae', 'dɔkota', 'dokota', 'wusiwusi', 'kusukusu', 'hye', 'keka', 'nsuo', 'ahwehwɛ', 'ahwehwe', 'ɛte sɛn', 'ete sen', 'mema wo', 'kasa', 'mope', 'mopɛ', 'laseense', 'adwuma', 'dɔn', 'don', 'sedis', 'abuakwa', 'kumasi'].some(w => q.includes(w));
  const tokens = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);

  // STEP 1: Emergency & Triage Detection
  const emergencyWords = ['emergency', 'chemical', 'bleach', 'acid', 'blind', 'detached', 'curtain', 'severe pain', 'blood', 'trauma', 'burst', 'anifura', 'mogya', 'egyina', 'borɔ', 'boro'];
  if (emergencyWords.some(w => q.includes(w))) {
    if (isTwi) {
      if (isVoice) {
        return `Sɛ w'ani afura prɛko pɛ, anaa borɔ bi agye w'ani so a, fa nsu pa hohoroo w'ani so ntɛm ara bɛyɛ sima dunum. Frɛ yɛn asopiti no tee wɔ 054 417 2089 anaa kɔ ayaresabea a ɛbɛn wo ntɛm ara.`;
      }
      return `🚨 **NTƐMPA ANI HUHOƆ ASƐM (EMERGENCY)**\n\nSɛ w'ani afura prɛko pɛ, nnuru anaasɛ borɔ bi agye w'ani so, anaa w'ani mu reyɛ wo ya kɛseɛ a:\n\n* **Nsu Pa**: Fa nsu pa a ɛho teɛ hohoroo w'ani so ntɛm ara bɛyɛ sima dunum (15 minutes).\n* **Frɛ Yɛn Ntɛm**: Frɛ yɛn ani ho dɔkotafoɔ seesei ara wɔ **${clinicData.phone || '+233 54 417 2089'}** anaa kɔ ayaresabea kɛseɛ a ɛbɛn wo ntɛm.\n\nYɛwɔ Abuakwa Kan Royal filling station nkyɛn pɛɛ a yɛbɛtumi ahwɛ wo ntɛm pa ara.`;
    }
    if (isVoice) {
      return `If you are experiencing sudden vision loss, severe eye pain, or a chemical splash, flush your eyes with clean water immediately for 15 minutes, then call our emergency clinic line at 054 417 2089 or visit the nearest hospital.`;
    }
    return `🚨 **URGENT CLINICAL TRIAGE NOTICE**\n\nIf you have sudden vision loss, severe acute ocular pain, or a chemical splash:\n\n* **Chemicals in Eye**: Flush eyes continuously with clean water for 15 minutes.\n* **Immediate Urgent Contact**: Call our clinic hotline immediately at **${clinicData.phone || '+233 54 417 2089'}** or proceed to the nearest emergency eye center.\n\nOur optometrists at Nova Eye Care Abuakwa are prepared for urgent ocular triage.`;
  }

  // STEP 2: DVLA Driver's License Eye Test
  if (q.includes('dvla') || q.includes('driver') || q.includes('license') || q.includes('driving') || q.includes('laseense') || q.includes('drayva') || q.includes('lɔre')) {
    if (isTwi) {
      if (isVoice) {
        return `Aane! Nova Eye Care yɛ beaeɛ a aban ne DVLA apene so sɛ yɛnsɔ lɔrekafoɔ ani ahwɛ. Ɛgye sima dunum kɔsi aduonu pɛ, na ne boɔ yɛ sedis aduasa pɛ a yɛde tumi krataa no bɛma wo seesei ara. Wobɛpɛ sɛ yɛfa beaeɛ to hɔ ma wo?`;
      }
      return `🚗 **DVLA Lɔrekafoɔ Laseense Ani Sɔhwɛ wɔ Nova Eye Care**\n\nAane! Nova Eye Care yɛ beaeɛ kɛseɛ a **DVLA apene so wɔ Ghana** sɛ yɛnsɔ lɔrekafoɔ foforɔ ne dada ani ahwɛ.\n\n* **Nea Yɛsɔ Hwɛ**: Sɛdeɛ w'ani hu adeɛ kɔ akyiri yie, kɔla ahodoɔ, ne w'ani nkyɛnkyɛn nhwɛeɛ.\n* **Mmerɛ a Ɛgye**: Sima 15 kɔsi 20 pɛ, na yɛbɔ so kyerɛw krataa no ama wo seesei ara.\n* **Ne Boɔ**: Sedis aduasa pɛ (GHS 30.00).\n\n👉 [Fa Beaeɛ To Hɔ ma DVLA Sɔhwɛ](/book) anaa frɛ yɛn wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `Yes! Nova Eye Care is an officially authorized facility for DVLA driver license eye tests in Ghana. The test takes about 15 to 20 minutes, costs 30 Ghana cedis, and you receive your certified stamped report on the spot. Would you like to schedule a visit?`;
    }
    return `🚗 **Official DVLA Eye Testing at Nova Eye Care**\n\nYes! We are an authorized, certified facility for **DVLA Driver License Eye Testing** in Ghana.\n\n* **What We Assess**: Distance visual acuity, peripheral fields of vision, and color recognition.\n* **Turnaround Time**: Certified official DVLA report stamped and issued immediately (takes ~15–20 minutes).\n* **Official Fee**: GHS 30.00.\n* **Who Needs It**: First-time applicants, license renewals, commercial drivers (taxi, trotro, haulage).\n\n👉 [Book Your DVLA Eye Test](/book) or call us at **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // STEP 3: Doctors & Optometrists Team
  if (q.includes('doctor') || q.includes('optometrist') || q.includes('sylvester') || q.includes('elizabeth') || q.includes('who works') || q.includes('staff') || q.includes('dɔkota') || q.includes('dokota') || q.includes('animdefoɔ')) {
    if (isTwi) {
      if (isVoice) {
        return `Yɛn ani ho abenfoɔ ne Dɔkota Sylvester Kyeremeh ne Dɔkota Elizabeth Mana Akpakli. Wɔwɔ nimdeɛ kɛseɛ wɔ mmofra ne mpaninfoɔ ani nhwehwɛmu, ahwehwɛ pa, ne glaucoma yareɛ mu.`;
      }
      return `👨‍⚕️ **Yɛn Ani Ho Dɔkotafoɔ wɔ Nova Eye Care**\n\nNova Eye Care wɔ ani ho animdefoɔ a wɔatwe fam pa ara:\n\n* **Dr. Sylvester Kyeremeh (OD)**: Ani ho panin a ɔhwɛ mmofra ani, ani ahwehwɛ a ɛfata, ne ani sa nhyehyɛeɛ so.\n* **Dr. Elizabeth Mana Akpakli (OD)**: Ɔbenfoɔ a ɔhwɛ ani nyarewa kɛseɛ te sɛ glaucoma ne asikyireyareɛ a ɛka ani, ne ani so ahwehwɛ nketewa.\n\n👉 [Fa Beaeɛ To Hɔ ma Dɔkota](/book) anaa frɛ yɛn wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `Our clinic is led by Dr. Sylvester Kyeremeh, expert in pediatric vision and eye therapy, and Dr. Elizabeth Mana Akpakli, specialist in ocular disease diagnostics and contact lenses. They are both licensed and ready to care for your eyes.`;
    }
    return `👨‍⚕️ **Meet Our Optometrists at Nova Eye Care**\n\nOur clinic is proudly staffed by licensed, experienced eye care specialists:\n\n* **Dr. Sylvester Kyeremeh (OD)**: Lead Optometrist & Vision Specialist. Specializes in pediatric vision, binocular vision therapy, and refractive disorders.\n* **Dr. Elizabeth Mana Akpakli (OD)**: Senior Optometrist & Ocular Health Specialist. Expert in glaucoma diagnosis, diabetic retinopathy, and custom contact lens fittings.\n\n👉 [Book an Examination with Our Doctors](/book) or call **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // STEP 4: Symptoms Analysis (Blurry vision, Glaucoma, Cataract, Dry eyes)
  if (q.includes('blur') || q.includes('wusiwusi') || q.includes('kusukusu') || q.includes('glaucoma') || q.includes('cataract') || q.includes('dry') || q.includes('pain') || q.includes('red eye') || q.includes('itch') || q.includes('keka') || q.includes('hye') || q.includes('strain') || q.includes('screen') || q.includes('computer')) {
    if (isTwi) {
      if (isVoice) {
        return `Sɛ w'ani so ayɛ wo wusiwusi anaasɛ ɛreyɛ wo ya a, ɛtumi firi ani ahwehwɛ a ɛhia wo, kɔmputa nsuhyew, anaa ani mu nhyɛsoɔ yareɛ te sɛ glaucoma. Yɛsrɛ wo bɛyɛ ani nhwehwɛmu na yɛahunu nea ɛrekɔ so tee.`;
      }
      return `👁️ **W'ani Ho Nsɛm ne Nhwehwɛmu**\n\nSɛ w'ani so ayɛ wo wusiwusi, ɛkeka wo, ɛhye wo, anaa ɛreyɛ wo ya a:\n\n* **Nea Ɛtumi De Ba**: Ani ahwehwɛ a ɛhia wo, kɔmputa ne fon a yɛhwɛ pii, ani so fitaa (cataract), anaa ani mu nhyɛsoɔ (glaucoma).\n* **Glaucoma Nsohyɛ**: Glaucoma yareɛ nni ya wɔ ahyɛaseɛ nanso ɛtumi fura onipa ani prɛko pɛ. Ɛno nti ɛsɛ sɛ yɛsɔ ani mu nhyɛsoɔ no hwɛ mprɛ pii.\n* **Ayaresa**: Yɛwɔ ani nhwehwɛmu a edi mu (GHS 50) a yɛde bɛhwɛ w'ani yie na yɛama wo aduro anaa ahwehwɛ a ɛfata wo.\n\n👉 [Fa Beaeɛ To Hɔ ma Ani Nhwehwɛmu](/book) anaa frɛ yɛn wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `Blurred vision or eye strain can stem from uncorrected refractive error, screen fatigue, or early conditions like cataracts and glaucoma. We recommend a comprehensive eye checkup so our optometrist can examine your eyes and provide the proper prescription.`;
    }
    return `👁️ **Clinical Symptom Evaluation & Guidance**\n\nBlurred vision, eye strain, dryness, or irritation often indicate:\n\n* **Refractive Errors**: Nearsightedness, farsightedness, or astigmatism requiring prescription glasses.\n* **Digital Eye Strain**: Prolonged phone/computer use causing dry ocular surface and muscle fatigue.\n* **Glaucoma Risk**: Elevated intraocular pressure that silently damages the optic nerve without early pain.\n* **Cataracts**: Gradual clouding of the natural crystalline lens.\n\nWe recommend a **Comprehensive Eye Examination (GHS 50.00)** for precise diagnosis.\n👉 [Book an Eye Exam](/book) or call **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // STEP 5: Location & Directions
  if (q.includes('location') || q.includes('address') || q.includes('where') || q.includes('direction') || q.includes('abuakwa') || q.includes('gps') || q.includes('find you') || q.includes('beaeɛ') || q.includes('beae') || q.includes('ɛhe') || q.includes('ehe') || q.includes('kwan') || q.includes('wo he')) {
    if (isTwi) {
      if (isVoice) {
        return `Yɛwɔ Abuakwa, Kan Royal pɛtroldwumadibea no nkyɛn pɛɛ wɔ Kumasi Sunyani kwan kɛseɛ no so. Yɛn GPS agyiraehyɛdeɛ ne AH 1192 7988. Frɛ yɛn wɔ 054 417 2089 na yɛakyerɛ wo kwan yie pa ara.`;
      }
      return `📍 **Nova Eye Care Beaeɛ a Yɛwɔ wɔ Abuakwa**\n\n* **Beaeɛ Ankasa**: GE20 Dolores St, Abuakwa, Ashanti Region.\n* **Agyiraehyɛdeɛ Kɛseɛ**: Kan Royal Filling Station nkyɛn pɛɛ wɔ Kumasi–Sunyani kwan kɛseɛ no so.\n* **GPS Digital Address**: AH-1192-7988 anaasɛ AH-1192-8485.\n* **Telefon**: **${clinicData.phone || '+233 54 417 2089'}** / 024 661 3184.\n\nWofiri Kumasi rekɔ Sunyani kwan so a, wobɛduru ha ntɛm pa ara.\n👉 [Fa Beaeɛ To Hɔ ma Ani Nhwehwɛmu](/book)`;
    }
    if (isVoice) {
      return `Nova Eye Care is located in Abuakwa, right next to the Kan Royal Filling Station along the Kumasi Sunyani road. Our digital GPS address is AH 1192 7988. Call us at 054 417 2089 if you need turn-by-turn directions.`;
    }
    return `📍 **Nova Eye Care Clinic Location & Directions**\n\n* **Address**: GE20 Dolores St, Abuakwa, Ashanti Region, Ghana.\n* **Key Landmark**: Directly adjacent to Kan Royal Filling Station, along the Kumasi–Sunyani Road.\n* **Digital GPS**: AH-1192-7988 / AH-1192-8485.\n* **Hotlines**: **${clinicData.phone || '+233 54 417 2089'}** / +233 24 661 3184.\n\nOur clinic offers secure parking and seamless accessibility from anywhere in Kumasi.\n👉 [Book an Appointment](/book)`;
  }

  // STEP 6: Opening Hours
  if (q.includes('hour') || q.includes('open') || q.includes('close') || q.includes('time') || q.includes('weekend') || q.includes('saturday') || q.includes('sunday') || q.includes('mmrɛ') || q.includes('mmre') || q.includes('dɔn') || q.includes('don') || q.includes('bue') || q.includes('ber ben') || q.includes('bere bɛn')) {
    if (isTwi) {
      if (isVoice) {
        return `Yɛbue Ɛdwoada kɔsi Efiada, anɔpa dɔn nwɔtwe kɔsi anwummere dɔn nnum. Memeneda nso yɛbue anɔpa dɔn nkron kɔsi awia dɔn mmienu. Kwasiada deɛ, yɛato mu.`;
      }
      return `⏰ **Mmerɛ a Yɛbue Adwuma wɔ Nova Eye Care**\n\n* **Ɛdwoada kɔsi Efiada (Mon–Fri)**: Anɔpa 8:00 AM – Anwummere 5:00 PM\n* **Memeneda (Saturday)**: Anɔpa 9:00 AM – Awia 2:00 PM\n* **Kwasiada (Sunday)**: Yɛato mu (Closed)\n\nWobɛtumi aba bere biara a yɛbue, anaa fa beaeɛ to hɔ wɔ intanɛte so.\n👉 [Fa Beaeɛ To Hɔ Seesei](/book) anaa frɛ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `We are open Monday to Friday from 8:00 AM to 5:00 PM, and on Saturdays from 9:00 AM to 2:00 PM. We are closed on Sundays. Both appointments and walk-ins are warmly welcomed.`;
    }
    return `⏰ **Nova Eye Care Clinic Hours**\n\n* **Monday – Friday**: 8:00 AM – 5:00 PM\n* **Saturday**: 9:00 AM – 2:00 PM\n* **Sunday**: Closed\n\nWalk-ins and scheduled appointments are both welcomed during operating hours.\n👉 [Book an Appointment Online](/book) or call **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // STEP 7: Pricing & Services
  if (q.includes('price') || q.includes('cost') || q.includes('how much') || q.includes('fee') || q.includes('charges') || q.includes('services') || q.includes('boɔ') || q.includes('boo') || q.includes('sika') || q.includes('ahe') || q.includes('eye fee')) {
    if (isTwi) {
      if (isVoice) {
        return `Ani nhwehwɛmu a edi mu no yɛ sedis aduonum pɛ, DVLA laseense sɔhwɛ no yɛ sedis aduasa pɛ, na glaucoma sɔhwɛ nso yɛ sedis aduonsia pɛ. Yɛgye Momo ne sika kɔkɔɔ nyinaa. Wobɛpɛ sɛ yɛfa beaeɛ to hɔ ma wo?`;
      }
      return `📋 **Yɛn Ani Dwumadi ne Boɔ a Yɛgye (Nova Eye Care)**\n\n* **Ani Nhwehwɛmu a Edi Mu (Comprehensive Eye Exam)**: Sedis aduonum pɛ (GHS 50.00)\n* **DVLA Laseense Ani Sɔhwɛ (DVLA Driver Test)**: Sedis aduasa pɛ (GHS 30.00)\n* **Ani Mu Nhyɛsoɔ Sɔhwɛ (Glaucoma Screening)**: Sedis aduonsia pɛ (GHS 60.00)\n* **Ani So Ahwehwɛ Nketewa (Contact Lens Fitting)**: Sedis aduɔson pɛ (GHS 70.00)\n* **Mmofra Ani Nhwehwɛmu (Pediatric & Lazy Eye Care)**: Sedis aduowɔtwe pɛ (GHS 80.00)\n* **Ani Ahwehwɛ Pa (Prescription Frames & Blue-Cut Lenses)**: Ɛfata sɛnea w'ani teɛ.\n\nSika a Yɛgye: MTN MoMo, Telecel Cash, AT Money, ne Sika kɔkɔɔ (Cash).\n👉 [Fa Beaeɛ To Hɔ Seesei](/book) anaa frɛ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `Our general comprehensive eye examination is 50 Ghana cedis, the DVLA eye test is 30 cedis, glaucoma screening is 60 cedis, and contact lens fitting is 70 cedis. We accept Mobile Money and cash. Would you like to schedule an appointment?`;
    }
    return `📋 **Official Nova Eye Care Services & Pricing**\n\n* **General Comprehensive Eye Exam**: GHS 50.00 (visual acuity, refraction, eye pressure, retina)\n* **DVLA Driver's License Eye Test**: GHS 30.00 (same-day official stamped certification)\n* **Glaucoma Screening & IOP Measurement**: GHS 60.00\n* **Contact Lens Fitting & Training**: GHS 70.00\n* **Binocular Vision & Pediatric Eye Care**: GHS 80.00\n* **Low Vision Rehabilitation**: GHS 40.00\n* **Optical Dispensing**: Designer frames, anti-glare/blue-cut lenses, photochromic transitions.\n\nAccepted Payments: Mobile Money (MTN MoMo, Telecel Cash), Cash, Bank Transfer.\n👉 [Book an Appointment](/book) or call **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // STEP 8: Booking Inquiry
  if (q.includes('book') || q.includes('appointment') || q.includes('schedule') || q.includes('reserve') || q.includes('kyerɛw') || q.includes('kyerew') || q.includes('to hɔ') || q.includes('to ho')) {
    if (isTwi) {
      if (isVoice) {
        return `Wobɛtumi afa beaeɛ ato hɔ ntɛm ara wɔ yɛn wɛbsaet yi so wɔ Abuakwa, anaa frɛ yɛn tee wɔ 054 417 2089 na yɛaboa wo seesei ara.`;
      }
      return `📅 **Kyerɛw Wo Din ma Ani Nhwehwɛmu**\n\nSɛ wobɛfa beaeɛ ato hɔ wɔ Nova Eye Care a, ɛnyɛ den koraa:\n\n1. Klike **[Fa Beaeɛ To Hɔ Seesei](/book)** a ɛwɔ ha no.\n2. Fa dwumadi a worepɛ, dɔkota a ɔbɛhwɛ wo, ne da a ɛfata wo to hɔ.\n3. Yɛbɛmane wo SMS ne email de ahyɛ wo bɔ seesei ara.\n\nSɛ worepɛ mmoa a, frɛ yɛn ntɛm wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
    }
    if (isVoice) {
      return `You can easily book an appointment online right here on our website, or call our clinic directly at 054 417 2089. We look forward to taking care of your vision!`;
    }
    return `📅 **Schedule Your Appointment at Nova Eye Care**\n\nBooking your visit is quick and convenient:\n\n1. Click **[Book Appointment Online](/book)**.\n2. Select your desired service, preferred optometrist, and convenient time slot.\n3. You will receive an immediate SMS and email booking confirmation.\n\nNeed personal assistance? Call us directly at **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  // STEP 9: Token Similarity against Knowledge Base entries
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

  // STEP 10: General Care Concierge Default
  if (isTwi) {
    if (isVoice) {
      return `Akwaaba! Me din de NOVA. Yɛwɔ Abuakwa Kan Royal filling station nkyɛn na yɛbɛtumi aboa wo wɔ ani nhwehwɛmu, DVLA sɔhwɛ, ne ahwehwɛ pa ho. Bisa me biribiara na memboa wo.`;
    }
    return `Akwaaba! 👋 Medaase pa ara sɛ woaba **NOVA Eye Care Services**.\n\nYɛwɔ Abuakwa Kan Royal filling station nkyɛn wɔ Kumasi, na yɛwɔ ha sɛ yɛbɛboa wo ama w'ani ahu adeɛ yie kɛseɛ:\n\n* **Ani Nhwehwɛmu a Edi Mu** (GHS 50)\n* **DVLA Laseense Ani Sɔhwɛ** (GHS 30)\n* **Ani Mu Nhyɛsoɔ / Glaucoma Sɔhwɛ** (GHS 60)\n* **Ani Ahwehwɛ Pa a Ɛsɛ W'ani**\n\nWobɛpɛ sɛ meboa wo wɔ dɛn ho nnɛ?\n👉 [Fa Beaeɛ To Hɔ Seesei](/book) anaa frɛ yɛn wɔ **${clinicData.phone || '+233 54 417 2089'}**.`;
  }

  if (isVoice) {
    return `Hello! I am NOVA, your patient care concierge at Nova Eye Care in Abuakwa. You can ask me about our services, pricing, DVLA test, opening hours, or eye symptoms. How can I help your vision today?`;
  }

  return `Hello! 👋 Welcome to **NOVA Eye Care Services** in Abuakwa, Kumasi.\n\nTagline: *"See Better! Live Brighter!"*\n\nWe provide complete vision checkups, authorized DVLA driver eye certification, custom contact lens fittings, and pediatric eye care.\n\nHow may we assist you today?\n* Ask about **Services & Prices** (DVLA test is GHS 30, General Exam is GHS 50)\n* Ask about **Clinic Location & Hours** (Abuakwa, near Kan Royal Filling Station)\n* Describe any **Eye Symptoms** or discomfort you are experiencing.\n\n👉 [Book an Appointment Online](/book) or call **${clinicData.phone || '+233 54 417 2089'}**.`;
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
      ? `\n\nCRITICAL LANGUAGE REQUIREMENT (100% PURE ASANTE TWI):
The patient has chosen Asante Twi (Akan). You MUST respond EXCLUSIVELY in pure, grammatically authentic, elegant Asante Twi.
DO NOT use English words or hybrid Pidgin.
Optometric Terms in Pure Asante Twi:
- DVLA Driver Eye Test = DVLA lɔrekafoɔ laseense ani sɔhwɛ (Sedis aduasa pɛ / GHS 30)
- Eye Examination = Ani nhwehwɛmu a edi mu (Sedis aduonum pɛ / GHS 50)
- Glaucoma = Ani mu nhyɛsoɔ yareɛ (Sedis aduonsia pɛ / GHS 60)
- Contact Lenses = Ani so ahwehwɛ nketewa (Sedis aduɔson pɛ / GHS 70)
- Cataracts = Ani so fitaa yareɛ / Nsuo a agyina ani so
- Doctor = Ani ho dɔkotafoɔ / Ani ho animdefoɔ (Dr. Sylvester Kyeremeh ne Dr. Elizabeth Mana Akpakli)
- Clinic Location = Abuakwa, Kan Royal pɛtroldwumadibea no nkyɛn pɛɛ wɔ Kumasi Sunyani kwan so
- Hours = Ɛdwoada kɔsi Efiada (Anɔpa 8:00 kɔsi Anwummere 5:00), Memeneda (Anɔpa 9:00 kɔsi Awia 2:00), Kwasiada yɛato mu.`
      : '\n\nLANGUAGE ADAPTATION: If the patient speaks or writes in Twi, analyze and answer in 100% pure Asante Twi. If in English, answer in polished, empathetic professional English.';

    const voiceInstruction = isVoice 
      ? `\n\nVOICE CALL REALTIME AUDIO PROTOCOL:
- The patient is on a LIVE HANDS-FREE VOICE CALL.
- Execute the 5-step Clinical & Contextual Analysis silently first.
- Keep the spoken response strictly to 2 or 3 concise, clear, natural sentences that sound wonderful aloud.
- Do NOT use markdown asterisks (*), hashtags (#), bullet points, or URLs.
- If Asante Twi: Speak pure, authentic, warm Akan (e.g., "Akwaaba! Yɛyɛ ani nhwehwɛmu nyinaa wɔ Abuakwa Kan Royal filling station nkyɛn, na DVLA sɔhwɛ no yɛ sedis aduasa pɛ. Wobɛpɛ sɛ yɛfa beaeɛ to hɔ ma wo?").`
      : `\n\nTEXT CHAT PROTOCOL:
- Execute the 5-step Clinical & Contextual Analysis silently first.
- Provide a clean markdown response with bullet points and helpful links: [Book Appointment](/book) and [Call Clinic: 054 417 2089](tel:0544172089).`;

    const systemPrompt = `${BASE_PROMPT}${languageInstruction}${voiceInstruction}${clinicInfo}${servicesInfo}${mapsContext}${kbContent}\n\nIMPORTANT: Maintain the highest standard of empathy and clinical clarity. Always ground answers in the clinic information above.`;

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

const db = require('../src/config/db');

const initialEntries = [
  {
    category: 'emergency',
    question: 'What should I do in an eye emergency?',
    answer: 'If you experience sudden severe eye pain, sudden vision loss, chemical splash in the eye, or severe eye trauma, seek immediate emergency medical care at an eye emergency center or call our clinic immediately at +233 54 417 2089. Flush chemical splashes with clean water continuously for 15 minutes.'
  },
  {
    category: 'services',
    question: 'What services does Nova Eye Care offer?',
    answer: 'We provide Comprehensive Eye Examinations, Specialist Contact Lens Fitting, Glaucoma Screening & Management, DVLA Eye Testing for driver licenses, Binocular Vision Therapy (for adults & children), Low Vision Rehabilitation, and Corporate Eye Screenings.'
  },
  {
    category: 'pricing',
    question: 'How much do your services cost?',
    answer: 'General Eye Examinations start at GHS 50, DVLA Eye Tests are GHS 30, Contact Lens Fitting is GHS 70, Glaucoma Screening is GHS 60, Low Vision Rehab is GHS 40, and Binocular Vision Services are GHS 80. Custom spectacles and contact lenses vary by prescription.'
  },
  {
    category: 'dvla',
    question: 'How do I get a DVLA eye test report for my driver license?',
    answer: 'Nova Eye Care is authorized for DVLA eye testing. We conduct thorough visual acuity and field tests for driver license application and renewal, and issue certified DVLA reports. The test costs GHS 30 and takes about 15-20 minutes.'
  },
  {
    category: 'symptoms',
    question: 'Why is my vision blurry?',
    answer: 'Blurred vision can result from refractive errors (nearsightedness, farsightedness, astigmatism), digital eye strain, cataracts, or retinal issues. We strongly advise booking a Comprehensive Eye Examination so our optometrist can accurately determine the cause and prescribe the right solution.'
  },
  {
    category: 'symptoms',
    question: 'What are the symptoms and risks of Glaucoma?',
    answer: 'Glaucoma is often called the "silent thief of sight" because it develops painlessly with no early symptoms until peripheral vision is lost. Early screening with eye pressure checks and optic nerve assessment is critical to prevent irreversible blindness.'
  },
  {
    category: 'symptoms',
    question: 'What is Dry Eye Syndrome and how is it treated?',
    answer: 'Dry Eye Syndrome causes gritty, burning sensations, redness, or paradoxical watery eyes, often triggered by long screen hours, air conditioning, or dust. We evaluate tear film quality and provide targeted treatments, lubricating therapies, and lifestyle guidance.'
  },
  {
    category: 'contact_lenses',
    question: 'Can I wear contact lenses and how do I get started?',
    answer: 'Yes! We offer Specialist Contact Lens Fitting (GHS 70) for daily, monthly, toric (astigmatism), and multifocal lenses. Our optometrists will measure your cornea, determine the right fit, and train you on safe insertion, removal, and hygiene.'
  },
  {
    category: 'children',
    question: 'Do you test children and offer therapy for lazy eye?',
    answer: 'Yes, our Binocular Vision Services specialize in pediatric vision assessments, squint/strabismus evaluation, eye teaming, and therapy for amblyopia (lazy eye) to support children\'s visual development and school performance.'
  },
  {
    category: 'payments',
    question: 'What payment methods do you accept?',
    answer: 'We accept Mobile Money (MTN MoMo, Telecel Cash, AT Money), cash, bank transfers, and major debit/credit cards at the clinic.'
  },
  {
    category: 'booking',
    question: 'How can I book, reschedule, or cancel an appointment?',
    answer: 'You can book directly on our website by clicking the "Book Appointment" button, or through your patient portal. You can view, reschedule, or cancel your appointments directly from your online dashboard or by calling +233 54 417 2089.'
  },
  {
    category: 'location',
    question: 'Where is Nova Eye Care located in Abuakwa?',
    answer: 'We are located at GE20 Dolores St, Abuakwa, near Kan Royal Filling Station, Ashanti Region, Ghana (Digital GPS: AH-1192-7988 / AH-1192-8485). Contact us at 0544172089 or 0246613184 for turn-by-turn assistance.'
  }
];

async function seed() {
  console.log('Seeding chatbot knowledge entries...');
  for (const entry of initialEntries) {
    const existing = await db.query(
      'SELECT id FROM chatbot_knowledge WHERE LOWER(question) = LOWER($1)',
      [entry.question]
    );
    if (existing.rows.length === 0) {
      await db.query(
        'INSERT INTO chatbot_knowledge (category, question, answer, active) VALUES ($1, $2, $3, true)',
        [entry.category, entry.question, entry.answer]
      );
      console.log(`+ Added: [${entry.category}] ${entry.question}`);
    } else {
      console.log(`= Already exists: ${entry.question}`);
    }
  }
  console.log('Knowledge base seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});

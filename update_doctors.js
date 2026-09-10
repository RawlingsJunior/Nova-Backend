const db = require('./src/config/db');

async function updateDoctors() {
  console.log('Updating doctors list in live database...');
  const newTeam = {
    members: [
      {
        name: "Dr. Sylvester Kyeremeh",
        title: "Lead Optometrist & Vision Specialist",
        bio: "Dr. Sylvester Kyeremeh has extensive clinical optometry experience, specializing in pediatric eye care, advanced vision therapy, and premium ocular diagnostics.",
        photo: ""
      },
      {
        name: "Dr. Elizabeth Mana Akpakli",
        title: "Senior Optometrist & Ocular Health Specialist",
        bio: "Dr. Elizabeth Mana Akpakli is an expert in ocular disease diagnostics, low vision rehabilitation, and custom contact lens fittings.",
        photo: ""
      }
    ]
  };

  try {
    const result = await db.query(
      `INSERT INTO cms_content (section_key, content_json)
       VALUES ('team', $1)
       ON CONFLICT (section_key)
       DO UPDATE SET content_json = $1, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(newTeam)]
    );
    console.log('Successfully updated doctor profiles in database!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update doctor profiles:', err);
    process.exit(1);
  }
}

updateDoctors();

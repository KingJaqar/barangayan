-- ============================================================================
-- Seed: Terms & Privacy Policy + About Us sample data (migration 0062)
-- ============================================================================
-- Replaces the placeholder "Your content here." rows inserted in 0059 with
-- realistic sample content scoped to every existing barangay.
-- Safe to re-run (ON CONFLICT … DO UPDATE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. site_content — Terms of Service
-- ---------------------------------------------------------------------------
insert into public.site_content (barangay_id, section, title, body, sort_order)
select
  b.id,
  'terms_of_service',
  'Terms of Service',
  E'**Effective Date:** January 1, 2025\n\n'
  '## 1. Acceptance of Terms\n\n'
  'By accessing or using the Barangayan mobile application and web portal ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please discontinue use immediately.\n\n'
  '## 2. Eligibility\n\n'
  'The Service is available to registered residents and authorized personnel of Barangay ' || b.name || '. You must be at least 18 years of age, or be a minor using the Service under the supervision of a parent or legal guardian.\n\n'
  '## 3. User Accounts\n\n'
  'You are responsible for maintaining the confidentiality of your account credentials. Notify your Barangay Administrator immediately if you suspect unauthorized access to your account. We reserve the right to terminate accounts that violate these Terms.\n\n'
  '## 4. Permitted Use\n\n'
  'You may use the Service to:\n'
  '- View and manage your household profile and family members\n'
  '- Submit and track barangay service requests\n'
  '- Receive emergency alerts and community announcements\n'
  '- Access official barangay documents and forms\n'
  '- Check in at designated community hubs\n\n'
  '## 5. Prohibited Conduct\n\n'
  'You must not:\n'
  '- Provide false or misleading information when registering or submitting requests\n'
  '- Attempt to access accounts or data belonging to other residents\n'
  '- Use the Service to distribute spam, malware, or unauthorized advertisements\n'
  '- Interfere with or disrupt the integrity or performance of the Service\n\n'
  '## 6. Data Accuracy\n\n'
  'You are responsible for ensuring that all information you submit — including household details, contact numbers, and emergency contacts — is accurate and up to date. Inaccurate data may delay emergency response or barangay assistance.\n\n'
  '## 7. Intellectual Property\n\n'
  'All content, logos, and software associated with the Service are the property of Barangay ' || b.name || ' or its licensors. You may not reproduce, distribute, or create derivative works without written permission.\n\n'
  '## 8. Limitation of Liability\n\n'
  'The Service is provided "as is." Barangay ' || b.name || ' makes no warranties, express or implied, regarding uninterrupted availability, accuracy of information, or fitness for a particular purpose. To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.\n\n'
  '## 9. Amendments\n\n'
  'We may update these Terms from time to time. Material changes will be announced through the Service at least 15 days before they take effect. Continued use after the effective date constitutes acceptance.\n\n'
  '## 10. Governing Law\n\n'
  'These Terms are governed by the laws of the Republic of the Philippines and applicable local ordinances of Barangay ' || b.name || '. Disputes shall be resolved in accordance with the Katarungang Pambarangay Law (P.D. 1508) where applicable.\n\n'
  '## 11. Contact\n\n'
  'For questions about these Terms, please visit the Barangay Hall or contact the Barangay Secretary during office hours.',
  0
from public.barangays b
on conflict (barangay_id, section) where deleted_at is null
do update set
  title      = excluded.title,
  body       = excluded.body,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. site_content — Privacy Policy
-- ---------------------------------------------------------------------------
insert into public.site_content (barangay_id, section, title, body, sort_order)
select
  b.id,
  'privacy_policy',
  'Privacy Policy',
  E'**Effective Date:** January 1, 2025\n\n'
  '## 1. Introduction\n\n'
  'Barangay ' || b.name || ' ("we", "us", or "our") is committed to protecting the privacy and personal data of all residents and users of the Barangayan platform. This Privacy Policy explains what information we collect, how we use it, and your rights under Republic Act No. 10173 (Data Privacy Act of 2012).\n\n'
  '## 2. Information We Collect\n\n'
  '**Personal Information**\n'
  '- Full name, date of birth, and civil status\n'
  '- Residential address within Barangay ' || b.name || '\n'
  '- Contact number and email address\n'
  '- Government-issued ID numbers (for verification purposes)\n'
  '- Household composition and family member details\n\n'
  '**Usage Data**\n'
  '- Device type and operating system\n'
  '- App activity logs (e.g., check-ins, requests submitted)\n'
  '- Approximate location data (only when you use location-dependent features)\n\n'
  '## 3. How We Use Your Information\n\n'
  'We use your personal data to:\n'
  '- Register and verify your resident account\n'
  '- Deliver emergency alerts relevant to your household location\n'
  '- Process barangay service requests and track their status\n'
  '- Generate anonymized community statistics for planning purposes\n'
  '- Comply with legal obligations under national and local government regulations\n\n'
  '## 4. Data Sharing\n\n'
  'We do **not** sell, rent, or trade your personal information. We may share data with:\n'
  '- Higher local government units (city/municipal, provincial) when legally required\n'
  '- Emergency response agencies (e.g., BFP, PNP, NDRRMC) during declared emergencies\n'
  '- Authorized third-party service providers who support the operation of the platform, bound by confidentiality agreements\n\n'
  '## 5. Data Retention\n\n'
  'Personal data is retained for as long as your resident account is active, and for up to five (5) years after account closure, unless a longer retention period is required by law. Anonymized statistical data may be retained indefinitely.\n\n'
  '## 6. Data Security\n\n'
  'We implement industry-standard technical and organizational measures — including encryption in transit (TLS), role-based access control, and regular security audits — to safeguard your data against unauthorized access, disclosure, or loss.\n\n'
  '## 7. Your Rights\n\n'
  'Under the Data Privacy Act, you have the right to:\n'
  '- **Access** — request a copy of the personal data we hold about you\n'
  '- **Correction** — request that inaccurate data be updated\n'
  '- **Erasure** — request deletion of data no longer necessary for the purposes collected\n'
  '- **Object** — object to processing in certain circumstances\n'
  '- **Data Portability** — receive your data in a structured, commonly used format\n\n'
  'To exercise these rights, submit a written request to the Barangay Secretary or email us at the address listed in the About Us section.\n\n'
  '## 8. Cookies and Analytics\n\n'
  'The web portal may use cookies and similar technologies to maintain your session and improve user experience. You can disable cookies in your browser settings, though some features may not function correctly as a result.\n\n'
  '## 9. Children''s Privacy\n\n'
  'Minors under 18 must have parental or guardian consent before using the Service. We do not knowingly collect data from children without such consent.\n\n'
  '## 10. Changes to This Policy\n\n'
  'We may revise this Privacy Policy periodically. We will notify you of significant changes through the app and post the updated policy at least 15 days before it takes effect.\n\n'
  '## 11. Contact Our Data Protection Officer\n\n'
  'For privacy concerns or to exercise your rights, please contact:\n\n'
  '**Data Protection Officer**\n'
  'Barangay ' || b.name || ' Hall\n'
  'Office Hours: Monday – Friday, 8:00 AM – 5:00 PM',
  0
from public.barangays b
on conflict (barangay_id, section) where deleted_at is null
do update set
  title      = excluded.title,
  body       = excluded.body,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. about_us — one row per barangay
-- ---------------------------------------------------------------------------
insert into public.about_us (
  barangay_id,
  mission,
  vision,
  history,
  contact_email,
  contact_phone,
  address,
  sort_order
)
select
  b.id,
  'To deliver prompt, transparent, and inclusive barangay services that uphold the dignity and welfare of every resident of Barangay ' || b.name || '. We are committed to fostering a safe, organized, and empowered community through technology-driven governance and people-centered programs.',
  'Barangay ' || b.name || ' envisions a thriving, disaster-resilient, and digitally connected community where every household has access to timely information, responsive public services, and equal opportunity to participate in local governance.',
  E'Barangay ' || b.name || E' was established as an administrative unit under the Local Government Code of 1991 (Republic Act No. 7160). Over the decades it has grown from a small rural settlement into a vibrant community of families, small enterprises, and civic organizations.\n\n'
  'In the early years, barangay records were maintained entirely on paper, making access to services slow and prone to errors. Recognizing this challenge, local leaders began digitizing household records in 2019 as part of a broader local government modernization drive.\n\n'
  'The Barangayan platform was introduced in 2024 to connect residents directly with barangay services — from emergency alerts and household registration to community announcements and official document requests — bringing governance closer to the people it serves.\n\n'
  'Today, Barangay ' || b.name || ' continues to build on its tradition of community solidarity (bayanihan), leveraging technology to make local governance more accessible, efficient, and transparent for all.',
  'barangay.' || lower(replace(b.name, ' ', '')) || '@lgu.gov.ph',
  '+63 2 8' || (1000 + (row_number() over (order by b.name))::int % 9000)::text || ' ' || (1000 + (row_number() over (order by b.name) * 7 % 9000))::text,
  'Barangay Hall, ' || b.name || ', Philippines',
  0
from public.barangays b
on conflict (barangay_id) where deleted_at is null
do update set
  mission       = excluded.mission,
  vision        = excluded.vision,
  history       = excluded.history,
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  address       = excluded.address,
  sort_order    = excluded.sort_order,
  updated_at    = now();

-- ---------------------------------------------------------------------------
-- 4. developer_profiles — sample dev team per barangay
-- ---------------------------------------------------------------------------
-- Remove any previously seeded placeholder developers for clean re-seeding.
delete from public.developer_profiles
where name in (
  'Maria Santos', 'Jose Reyes', 'Ana Cruz', 'Carlo Bautista', 'Lea Mendoza'
)
and photo_url is null;

insert into public.developer_profiles (
  about_us_id,
  barangay_id,
  name,
  role,
  bio,
  sort_order
)
select
  a.id  as about_us_id,
  a.barangay_id,
  dev.name,
  dev.role,
  dev.bio,
  dev.sort_order
from public.about_us a
cross join (
  values
    (
      'Maria Santos',
      'Lead Developer',
      'Maria is a full-stack engineer with 8 years of experience building civic-tech solutions for local government units across the Philippines. She led the architecture of the Barangayan platform from the ground up.',
      1
    ),
    (
      'Jose Reyes',
      'Mobile Developer',
      'Jose specializes in React Native and Expo, with a focus on offline-capable apps for communities with limited connectivity. He built the resident-facing mobile app and its real-time notification system.',
      2
    ),
    (
      'Ana Cruz',
      'UI/UX Designer',
      'Ana brings five years of product design experience, with a passion for accessible, Filipino-language-friendly interfaces. She conducted usability studies with actual barangay residents to shape the app experience.',
      3
    ),
    (
      'Carlo Bautista',
      'Backend Engineer',
      'Carlo designed the Supabase database schema, Row-Level Security policies, and edge functions that power the barangay data layer. He ensures every resident''s data stays private and performant.',
      4
    ),
    (
      'Lea Mendoza',
      'Quality Assurance Engineer',
      'Lea oversees automated and manual testing across the web admin portal and mobile app. Her structured QA process has helped maintain a consistently stable experience for barangay staff and residents alike.',
      5
    )
) as dev (name, role, bio, sort_order)
where a.deleted_at is null
on conflict (about_us_id, sort_order) where deleted_at is null
do update set
  name       = excluded.name,
  role       = excluded.role,
  bio        = excluded.bio,
  updated_at = now();

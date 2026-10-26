import React, { useMemo, useState } from 'react';
import './CommunityCorps.css';

const initialVolunteers = [
  {
    id: 1,
    name: 'Demo Volunteer One',
    phone: '',
    area: 'Central District',
    skills: ['First Aid', 'Community Support'],
    availability: 'Available',
    task: 'Assist with community needs assessment',
    status: 'Registered',
  },
  {
    id: 2,
    name: 'Demo Volunteer Two',
    phone: '',
    area: 'North District',
    skills: ['Logistics', 'Distribution'],
    availability: 'Available',
    task: 'Support relief supply distribution',
    status: 'Registered',
  },
];

const skillOptions = [
  'First Aid',
  'Logistics',
  'Distribution',
  'Driving',
  'Community Support',
  'Search and Rescue',
  'Communication',
  'Data Collection',
];

// 👇 1. ADDED onBack HERE 👇
function CommunityCorps({ onBack }) {
  const [volunteers, setVolunteers] = useState(initialVolunteers);
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('All');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    area: '',
    skills: [],
    availability: 'Available',
  });

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const toggleSkill = (skill) => {
    setForm((previous) => ({
      ...previous,
      skills: previous.skills.includes(skill)
        ? previous.skills.filter((item) => item !== skill)
        : [...previous.skills, skill],
    }));
  };

  const registerVolunteer = (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.area.trim() || form.skills.length === 0) {
      setMessage('Enter a name and area, and select at least one skill.');
      return;
    }

    const volunteer = {
      id: Date.now(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      area: form.area.trim(),
      skills: form.skills,
      availability: form.availability,
      task: 'No task assigned',
      status: 'Registered',
    };

    setVolunteers((previous) => [volunteer, ...previous]);
    setForm({
      name: '',
      phone: '',
      area: '',
      skills: [],
      availability: 'Available',
    });
    setMessage('Volunteer added successfully to this demo session.');
  };

  const updateVolunteer = (id, field, value) => {
    setVolunteers((previous) =>
      previous.map((volunteer) =>
        volunteer.id === id
          ? { ...volunteer, [field]: value }
          : volunteer
      )
    );
  };

  const filteredVolunteers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return volunteers.filter((volunteer) => {
      const matchesSearch = [
        volunteer.name,
        volunteer.area,
        volunteer.skills.join(' '),
        volunteer.task,
      ].some((value) => value.toLowerCase().includes(query));

      const matchesAvailability =
        availabilityFilter === 'All' ||
        volunteer.availability === availabilityFilter;

      return matchesSearch && matchesAvailability;
    });
  }, [volunteers, search, availabilityFilter]);

  const availableCount = volunteers.filter(
    (volunteer) => volunteer.availability === 'Available'
  ).length;

  const assignedCount = volunteers.filter(
    (volunteer) => volunteer.task !== 'No task assigned'
  ).length;

  return (
    <main className="corps-page">
      {/* 👇 2. ADDED THE BACK BUTTON HERE 👇 */}
      <button
        onClick={onBack}
        style={{
          marginBottom: '20px',
          background: 'transparent',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        ← Back to Home
      </button>

      <header className="corps-header">
        <div>
          <p className="corps-eyebrow">SHOCKREADY • COMMUNITY RESPONSE</p>
          <h1>Community Resilience Corps</h1>
          <p>
            Coordinate volunteers, organize skills, and support communities
            during emergencies.
          </p>
        </div>
        <div className="corps-header-icon" aria-hidden="true">♧</div>
      </header>

      <div className="corps-notice">
        Demo mode: volunteer information is stored only in the current page
        session. Supabase integration will be added later.
      </div>

      <section className="corps-stats" aria-label="Volunteer summary">
        <article className="corps-stat">
          <span>Total volunteers</span>
          <strong>{volunteers.length}</strong>
        </article>
        <article className="corps-stat">
          <span>Available</span>
          <strong>{availableCount}</strong>
        </article>
        <article className="corps-stat">
          <span>With assigned tasks</span>
          <strong>{assignedCount}</strong>
        </article>
      </section>

      <section className="corps-panel">
        <div className="corps-section-heading">
          <div>
            <p className="corps-eyebrow">JOIN THE RESPONSE</p>
            <h2>Register a volunteer</h2>
          </div>
        </div>

        <form className="corps-form" onSubmit={registerVolunteer}>
          <label>
            Full name *
            <input
              name="name"
              value={form.name}
              onChange={updateForm}
              placeholder="Enter volunteer's name"
              required
            />
          </label>

          <label>
            Phone number
            <input
              name="phone"
              value={form.phone}
              onChange={updateForm}
              placeholder="Enter contact number"
              type="tel"
            />
          </label>

          <label>
            Area or community *
            <input
              name="area"
              value={form.area}
              onChange={updateForm}
              placeholder="e.g. Lusaka District"
              required
            />
          </label>

          <label>
            Availability
            <select
              name="availability"
              value={form.availability}
              onChange={updateForm}
            >
              <option>Available</option>
              <option>Unavailable</option>
              <option>On Assignment</option>
            </select>
          </label>

          <fieldset className="corps-skills">
            <legend>Skills * (select at least one)</legend>
            <div className="corps-skill-options">
              {skillOptions.map((skill) => (
                <label className="corps-skill-option" key={skill}>
                  <input
                    type="checkbox"
                    checked={form.skills.includes(skill)}
                    onChange={() => toggleSkill(skill)}
                  />
                  <span>{skill}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button className="corps-primary-button" type="submit">
            Register volunteer
          </button>
        </form>

        {message && (
          <p className="corps-message" role="status">{message}</p>
        )}
      </section>

      <section className="corps-panel">
        <div className="corps-section-heading">
          <div>
            <p className="corps-eyebrow">TEAM DIRECTORY</p>
            <h2>Volunteer coordination</h2>
          </div>
        </div>

        <div className="corps-filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, area, skill, or task..."
            aria-label="Search volunteers"
          />
          <select
            value={availabilityFilter}
            onChange={(event) => setAvailabilityFilter(event.target.value)}
            aria-label="Filter by availability"
          >
            <option value="All">All availability</option>
            <option value="Available">Available</option>
            <option value="Unavailable">Unavailable</option>
            <option value="On Assignment">On Assignment</option>
          </select>
        </div>

        <div className="corps-volunteer-list">
          {filteredVolunteers.map((volunteer) => (
            <article className="corps-volunteer-card" key={volunteer.id}>
              <div className="corps-volunteer-top">
                <div className="corps-avatar" aria-hidden="true">
                  {volunteer.name.charAt(0).toUpperCase()}
                </div>
                <div className="corps-volunteer-details">
                  <h3>{volunteer.name}</h3>
                  <p>{volunteer.area}</p>
                  {volunteer.phone && <p>{volunteer.phone}</p>}
                </div>
                <span className={`corps-status corps-status-${volunteer.availability.toLowerCase().replaceAll(' ', '-')}`}>
                  {volunteer.availability}
                </span>
              </div>

              <div className="corps-tags">
                {volunteer.skills.map((skill) => (
                  <span className="corps-tag" key={skill}>{skill}</span>
                ))}
              </div>

              <label className="corps-task-label">
                Assigned task
                <input
                  value={volunteer.task}
                  onChange={(event) =>
                    updateVolunteer(volunteer.id, 'task', event.target.value)
                  }
                  placeholder="Enter assigned task"
                />
              </label>

              <label className="corps-task-label">
                Availability status
                <select
                  value={volunteer.availability}
                  onChange={(event) =>
                    updateVolunteer(
                      volunteer.id,
                      'availability',
                      event.target.value
                    )
                  }
                >
                  <option>Available</option>
                  <option>Unavailable</option>
                  <option>On Assignment</option>
                </select>
              </label>
            </article>
          ))}

          {filteredVolunteers.length === 0 && (
            <p className="corps-empty">
              No volunteers match your search. Try another search or filter.
            </p>
          )}
        </div>
      </section>

      <footer className="corps-footer">
        ShockReady Community Resilience Corps · Demo version
      </footer>
    </main>
  );
}

export default CommunityCorps;
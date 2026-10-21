/* Made-up data for previewing the dashboards before the API is live.
   Open dashboard.html?preview=customer, customer-empty, engineer or pending.
   The shapes match what the API routes are expected to return. */
const SAMPLE = (() => {
  const daysAgo = (d, h = 11, m = 42) => {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(h, m, 0, 0);
    return t.toISOString();
  };

  const customer = {
    me: { displayName: "Hannah Cole", companyName: "Northgate Dental", role: "customer" },
    projects: [{
      id: "p-northgate",
      name: "Online booking for Northgate Dental",
      repo: { fullName: "northgate/booking-site", url: "#" },
      stagingUrl: "#",
      milestone: { current: 2, total: 4, next: { name: "Online deposits with Stripe", due: "2026-11-14" } },
      engineers: [
        { displayName: "Zack", role: "primary", focus: "Primary engineer" },
        { displayName: "Priya Shah", role: "secondary", focus: "Supporting on payments" }
      ]
    }],
    updates: {
      "p-northgate": {
        latest: {
          sha: "c41e9a7",
          message: "Appointment reminders by email and SMS",
          author: "Zack",
          committedAt: daysAgo(0),
          branch: "main",
          points: [
            "Patients now get an email 48 hours before their appointment and a text 2 hours before.",
            "Reminder wording is in one file, so reception can change it without a developer.",
            "Texts go through Twilio in test mode for now. Nothing is sent to real numbers until you sign off.",
            "Next up: the deposit step at checkout, which Priya is helping with."
          ]
        },
        earlier: [
          { sha: "8b02d1f", message: "Reception view of the day’s bookings", committedAt: daysAgo(2) },
          { sha: "f7a3c90", message: "Availability rules per dentist", committedAt: daysAgo(4) },
          { sha: "29de4b1", message: "Booking form and confirmation email", committedAt: daysAgo(8) },
          { sha: "a1f3c0e", message: "Scope signed off", committedAt: daysAgo(15) }
        ]
      }
    }
  };

  const customerEmpty = {
    me: { displayName: "Sam Okafor", companyName: "Okafor Joinery", role: "customer" },
    projects: [],
    updates: {}
  };

  const engineer = {
    me: { displayName: "Priya Shah", role: "engineer", engineerStatus: "approved" },
    active: [
      {
        id: "p-okafor",
        name: "Job tracker for Okafor Joinery",
        repo: { fullName: "okafor/job-tracker", url: "#" },
        myRole: "primary",
        detail: "Milestone 1 of 3 · due 30 October",
        lastCommit: { sha: "e5c1a08", message: "Fitter job list with offline sync" },
        offers: [
          { id: "o-1", engineer: { displayName: "Tom Reid" }, message: "I have built offline sync with IndexedDB before, happy to take the conflict handling." }
        ]
      },
      {
        id: "p-northgate",
        name: "Online booking for Northgate Dental",
        repo: { fullName: "northgate/booking-site", url: "#" },
        myRole: "secondary",
        addedBy: "Zack",
        detail: "Milestone 2 of 4 · your part: online deposits",
        lastCommit: { sha: "c41e9a7", message: "Appointment reminders by email and SMS" },
        offers: []
      }
    ],
    closed: [
      { id: "p-harbour-web", repo: { fullName: "harbour/website" }, client: "Harbour Logistics", myRole: "primary", releaseTag: "v2.1.0", closedAt: "2026-10-03" },
      { id: "p-bl-onboard", repo: { fullName: "brightledger/onboarding" }, client: "BrightLedger", myRole: "secondary", releaseTag: "v1.0.0", closedAt: "2026-08-12" },
      { id: "p-okafor-fix", repo: { fullName: "okafor/website-fixes" }, client: "Okafor Joinery", myRole: "primary", releaseTag: "v1.3.2", closedAt: "2026-07-28" }
    ],
    colleagues: [
      { id: "p-harbour-api", repo: "harbour/fleet-api", stack: "Node · PostgreSQL · AWS", primary: "Zack", helpWanted: "Wants help with the Terraform for staging", offerStatus: null },
      { id: "p-ledger", repo: "brightledger/ledger-sync", stack: "TypeScript · Stripe", primary: "Tom Reid", helpWanted: "Open to help on webhooks", offerStatus: "pending" },
      { id: "p-meadow", repo: "meadow/patient-portal", stack: "React · Azure", primary: "Zack", helpWanted: null, offerStatus: null }
    ]
  };

  const pending = {
    me: { displayName: "Alex Morgan", role: "engineer", engineerStatus: "pending" }
  };

  return { customer, "customer-empty": customerEmpty, engineer, pending };
})();

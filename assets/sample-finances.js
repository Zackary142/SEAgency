/* Sample data for the admin Finances page, shown when SITE.apiUrl is empty
   (finances.html?preview=admin). Made up: no real clients or money.
   Dates are relative to today so the graph always has the last twelve months. */
window.SAMPLE_FINANCES = (() => {
  const now = new Date();
  // A day n months ago, as YYYY-MM-DD.
  const monthsAgo = (n, day = 12) => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - n, Math.min(day, 28)));
    return d.toISOString().slice(0, 10);
  };
  const daysAhead = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  let n = 0;
  const charge = (kind, name, pounds, status, paidMonthsAgo, extra = {}) => {
    const amountPence = pounds * 100;
    return {
      id: `c-${++n}`, kind, name, amountPence, status,
      dueOn: extra.dueOn || null,
      invoicedAt: status === "planned" ? null : new Date().toISOString(),
      paidOn: status === "paid" ? monthsAgo(paidMonthsAgo, extra.day) : null,
      companyCutPence: status === "paid" ? Math.round(amountPence * (extra.cut ?? 20) / 100) : null
    };
  };

  return {
    me: { displayName: "Zack", role: "admin" },
    projects: [
      { id: "p-northgate", name: "Online booking for Northgate Dental", status: "active",
        customer: { displayName: "Hannah Cole", companyName: "Northgate Dental" }, companyCutPercent: 20,
        charges: [
          charge("stage", "Plan and designs", 1800, "paid", 2, { day: 4 }),
          charge("stage", "Booking and reminders", 4200, "paid", 1, { day: 20 }),
          charge("stage", "Online deposits with Stripe", 2600, "invoiced", 0, { dueOn: daysAhead(5) }),
          charge("stage", "Launch and handover", 1400, "planned", 0, { dueOn: daysAhead(30) }),
          charge("extra", "Second practice added", 900, "paid", 0, { day: 3 })
        ] },
      { id: "p-okafor", name: "Wardrobe quotes for Okafor Joinery", status: "active",
        customer: { displayName: "Sam Okafor", companyName: "Okafor Joinery" }, companyCutPercent: 20,
        charges: [
          charge("stage", "Plan and price agreed", 750, "paid", 0, { day: 2 }),
          charge("stage", "Quote builder", 2400, "planned", 0, { dueOn: daysAhead(21) }),
          charge("stage", "Deposits and Xero", 1650, "planned", 0)
        ] },
      { id: "p-ledger", name: "Ledger sync", status: "paused",
        customer: { displayName: "Owen Price", companyName: "Bright Ledger" }, companyCutPercent: 25,
        charges: [
          charge("stage", "Discovery", 1200, "paid", 5, { day: 9, cut: 25 }),
          charge("stage", "Bank feed import", 3200, "paid", 4, { day: 15, cut: 25 }),
          charge("stage", "Reconciliation screens", 2800, "invoiced", 0)
        ] },
      { id: "p-harbour", name: "Harbour Coffee loyalty app", status: "closed",
        customer: { displayName: "Mia Lewis", companyName: "Harbour Coffee" }, companyCutPercent: 20,
        charges: [
          charge("stage", "Plan and designs", 1500, "paid", 10, { day: 6 }),
          charge("stage", "Stamp card app", 3800, "paid", 9, { day: 18 }),
          charge("stage", "Rewards and offers", 2900, "paid", 8, { day: 21 }),
          charge("stage", "App store launch", 1600, "paid", 7, { day: 11 }),
          charge("extra", "Hosting, first year", 480, "paid", 7, { day: 11 }),
          charge("extra", "Extra push campaign", 650, "paid", 6, { day: 25 })
        ] },
      { id: "p-fern", name: "Speed fixes for Fern & Moss", status: "closed",
        customer: { displayName: "Lena Brooks", companyName: "Fern & Moss" }, companyCutPercent: 20,
        charges: [
          charge("stage", "Audit", 400, "paid", 11, { day: 8 }),
          charge("stage", "Theme fixes", 1100, "paid", 3, { day: 14 })
        ] }
    ],
    expenses: [
      { id: "x-1", description: "Neon database, monthly", amountPence: 1900, spentOn: monthsAgo(0, 1) },
      { id: "x-2", description: "Neon database, monthly", amountPence: 1900, spentOn: monthsAgo(1, 1) },
      { id: "x-3", description: "Accountant, quarterly", amountPence: 36000, spentOn: monthsAgo(2, 28) },
      { id: "x-4", description: "Neon database, monthly", amountPence: 1900, spentOn: monthsAgo(2, 1) },
      { id: "x-5", description: "ICO data protection fee", amountPence: 5200, spentOn: monthsAgo(4, 10) },
      { id: "x-6", description: "Business cards", amountPence: 3400, spentOn: monthsAgo(6, 7) },
      { id: "x-7", description: "Domain, two years", amountPence: 2600, spentOn: monthsAgo(9, 3) }
    ]
  };
})();

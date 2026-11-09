/* Made-up chats for previewing chat.html before the API is live.
   Open chat.html?preview=customer, engineer or admin. The people and projects
   match sample-data.js, and the shapes match the API's /chats routes. */
const SAMPLE_CHATS = (() => {
  const ago = (days, h, m) => {
    const t = new Date();
    t.setDate(t.getDate() - days);
    t.setHours(h, m, 0, 0);
    return t.toISOString();
  };

  // Every chat, as the admin sees it. Each view below picks the ones its person is in.
  const chats = {
    "p-northgate": {
      name: "Online booking for Northgate Dental",
      status: "active",
      customer: "Hannah Cole, Northgate Dental",
      engineers: ["Zack", "Priya Shah"],
      messages: [
        ["Hannah Cole", "customer", ago(2, 9, 12), "Morning! Reception asked whether patients can book for their children under their own login. Is that something we can do?"],
        ["Zack", "engineer", ago(2, 9, 40), "Morning Hannah. Yes, we can. I'd add a \"family members\" section to the patient account, so a parent books for anyone listed there. It's about a day's work and fits in this stage."],
        ["Hannah Cole", "customer", ago(2, 9, 48), "Perfect, please go ahead."],
        ["Zack", "engineer", ago(0, 10, 5), "Quick update: appointment reminders are live on the test site. Patients get an email 48 hours before and a text 2 hours before. Have a look when you get a minute."],
        ["Priya Shah", "engineer", ago(0, 10, 20), "Hi Hannah, I'm helping Zack with deposits. Do you want the deposit refunded automatically if someone cancels more than 24 hours ahead?"],
        ["Hannah Cole", "customer", ago(0, 11, 2), "Just tried it, the reminder came through straight away. And yes please, refund automatically if it's more than 24 hours."],
        ["Priya Shah", "engineer", ago(0, 11, 9), "Great, I'll set it up that way. You'll see it on the test site by Friday."]
      ],
      replies: {
        customer: "Thanks Hannah, noted. I'll get back to you on that this afternoon.",
        engineer: "Lovely, thank you both. That all sounds good to me."
      }
    },
    "p-okafor": {
      name: "Job tracker for Okafor Joinery",
      status: "active",
      customer: "Sam Okafor, Okafor Joinery",
      engineers: ["Priya Shah"],
      messages: [
        ["Sam Okafor", "customer", ago(1, 16, 30), "Hi Priya, the lads lose signal on most sites. Will the app still work when they're out in the van?"],
        ["Priya Shah", "engineer", ago(1, 17, 2), "Hi Sam, yes. The app keeps jobs on the phone and sends them when signal comes back. I'm building that this week."],
        ["Sam Okafor", "customer", ago(0, 8, 15), "Brilliant. Can they add photos of finished jobs too?"]
      ],
      replies: {
        customer: "Thanks Sam, I'll look into it and come back to you today.",
        engineer: "Sounds great, thanks Priya."
      }
    },
    "p-ledger": {
      name: "Ledger sync",
      status: "paused",
      customer: "Owen Price, Bright Ledger",
      engineers: ["Tom Reid"],
      messages: [
        ["Owen Price", "customer", ago(9, 14, 0), "We need to pause for a few weeks while our accountant switches software. Sorry about this!"],
        ["Tom Reid", "engineer", ago(9, 14, 25), "No problem at all, Owen. Everything is saved, so we can pick it up whenever you're ready."],
        ["Zack", "admin", ago(9, 15, 10), "Thanks Owen. I've paused the project, so you won't be billed until it restarts. Just message here when you're ready to go again."]
      ],
      replies: {
        customer: "Thanks Owen, that's fine. Speak soon.",
        engineer: "Will do, thanks both."
      }
    },
    "p-harbour": {
      name: "Harbour Coffee loyalty app",
      status: "closed",
      customer: "Mia Lewis, Harbour Coffee",
      engineers: ["Priya Shah", "Tom Reid"],
      messages: [
        ["Priya Shah", "engineer", ago(40, 11, 0), "The app is live in both stores now. Customers can collect stamps from today."],
        ["Mia Lewis", "customer", ago(40, 12, 30), "We've had 60 sign ups already! Thank you both so much."],
        ["Tom Reid", "engineer", ago(39, 9, 5), "Great to hear, Mia. The handover notes and logins are in your inbox."]
      ],
      replies: {}
    }
  };

  // Who is signed in for each preview, and which chats they're in.
  const views = {
    customer: { me: { displayName: "Hannah Cole", companyName: "Northgate Dental", role: "customer" }, chats: ["p-northgate"] },
    engineer: { me: { displayName: "Priya Shah", role: "engineer", engineerStatus: "approved" }, chats: ["p-okafor", "p-northgate"] },
    admin: { me: { displayName: "Zack", role: "admin" }, chats: ["p-okafor", "p-northgate", "p-ledger", "p-harbour"] }
  };

  // Unread counts so the list shows the badge. Read marks clear them as chats are opened.
  const unread = { customer: { "p-northgate": 1 }, engineer: { "p-okafor": 1 }, admin: { "p-okafor": 1 } };

  return { chats, views, unread };
})();

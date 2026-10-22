/* Ledgerlight — sample household generator.
   Produces ~24 months of consistent history ending today: salary, EMIs, SIPs, bills,
   subscriptions (with a price rise), lifestyle creep, festive spikes, trips and a few anomalies.
   All names are fictional. */
window.LL = window.LL || {};
(function (LL) {
  'use strict';
  const U = LL.U;

  /* ---------- default categories (also used for "start fresh") ---------- */
  const CATS = [
    // income
    ['salary', 'Salary', 'Income', 'income'], ['freelance', 'Freelance', 'Income', 'income'],
    ['interest', 'Interest', 'Income', 'income'], ['dividends', 'Dividends', 'Income', 'income'],
    ['refunds', 'Refunds & Cashback', 'Income', 'income'], ['gifts_in', 'Gifts Received', 'Income', 'income'], ['other_in', 'Other Income', 'Income', 'income'],
    ['rent', 'Rent', 'Housing', 'expense'], ['uncat', 'Uncategorised', 'Other', 'expense'],
    // housing
    ['emi_home', 'Home Loan EMI', 'Housing', 'expense'], ['maintenance', 'Society Maintenance', 'Housing', 'expense'],
    ['electricity', 'Electricity', 'Utilities', 'expense'], ['internet', 'Internet', 'Utilities', 'expense'],
    ['mobile', 'Mobile', 'Utilities', 'expense'], ['water_gas', 'Water & Gas', 'Utilities', 'expense'],
    // food
    ['groceries', 'Groceries', 'Food', 'expense'], ['dining', 'Dining Out', 'Food', 'expense'],
    ['delivery', 'Food Delivery', 'Food', 'expense'], ['coffee', 'Coffee & Snacks', 'Food', 'expense'],
    // transport
    ['fuel', 'Fuel', 'Transport', 'expense'], ['cabs', 'Cabs & Autos', 'Transport', 'expense'],
    ['metro', 'Metro & Bus', 'Transport', 'expense'], ['car_service', 'Car Service', 'Transport', 'expense'],
    ['emi_car', 'Car Loan EMI', 'Transport', 'expense'],
    // shopping
    ['online', 'Online Shopping', 'Shopping', 'expense'], ['clothing', 'Clothing', 'Shopping', 'expense'],
    ['electronics', 'Electronics', 'Shopping', 'expense'], ['home_kitchen', 'Home & Kitchen', 'Shopping', 'expense'],
    // fun
    ['streaming', 'Streaming & Apps', 'Entertainment', 'expense'], ['movies', 'Movies & Events', 'Entertainment', 'expense'],
    ['games', 'Games & Hobbies', 'Entertainment', 'expense'],
    // health
    ['pharmacy', 'Pharmacy', 'Health', 'expense'], ['doctor', 'Doctor & Hospital', 'Health', 'expense'],
    ['gym', 'Gym & Fitness', 'Health', 'expense'], ['insurance', 'Insurance', 'Health', 'expense'],
    // personal
    ['grooming', 'Grooming', 'Personal', 'expense'], ['education', 'Books & Courses', 'Personal', 'expense'],
    ['gifts_out', 'Gifts Given', 'Personal', 'expense'], ['charity', 'Charity', 'Personal', 'expense'],
    // travel
    ['flights', 'Flights & Trains', 'Travel', 'expense'], ['hotels', 'Hotels & Stays', 'Travel', 'expense'],
    ['trip_misc', 'Trip Spending', 'Travel', 'expense'],
    // financial
    ['fees', 'Fees & Charges', 'Financial', 'expense'], ['taxes', 'Taxes', 'Financial', 'expense'],
    // transfers
    ['transfer', 'Transfer', 'Transfer', 'transfer'], ['invest', 'Investment Contribution', 'Transfer', 'transfer'],
    ['cc_payment', 'Card Payment', 'Transfer', 'transfer'], ['atm', 'Cash Withdrawal', 'Transfer', 'transfer'],
  ];
  const GROUP_ICON = { Income: 'coin', Housing: 'house', Utilities: 'bolt', Food: 'heart', Transport: 'car', Shopping: 'tag', Entertainment: 'sparkle', Health: 'shield', Personal: 'sparkle', Travel: 'flow', Financial: 'bank', Transfer: 'repeat' };
  LL.defaultCategories = () => CATS.map(([id, name, group, type]) => ({ id: 'cat_' + id, name, group, type, icon: GROUP_ICON[group] || 'tag' }));

  /* keyword categoriser for imports when no user rule matches */
  const KEYWORDS = [
    [/salary|payroll|sal cr/i, 'salary', 'income'], [/interest|int\.? cr|int pd/i, 'interest', 'income'], [/dividend|div /i, 'dividends', 'income'],
    [/refund|reversal|cashback/i, 'refunds', 'income'], [/freelance|invoice|consult/i, 'freelance', 'income'],
    [/rent\b|house rent/i, 'rent'], [/maintenance|society/i, 'maintenance'], [/electric|power|bescom|discom/i, 'electricity'],
    [/broadband|fiber|fibre|internet|wifi/i, 'internet'], [/mobile|recharge|postpaid|airtel|jio|vodafone|\bvi\b/i, 'mobile'], [/gas|water bill/i, 'water_gas'],
    [/swiggy|zomato|feastfleet|tiffintap|food delivery|domino|pizza/i, 'delivery'], [/restaurant|cafe|café|bistro|kitchen|dine|bar\b|brew/i, 'dining'],
    [/coffee|starbucks|chai|tea |bakery|snack/i, 'coffee'], [/grocery|groceries|mart|supermarket|bigbasket|blinkit|zepto|kirana|fresh/i, 'groceries'],
    [/uber|ola\b|rapido|cab|taxi|quickride|autogo|auto /i, 'cabs'], [/metro|bus|irctc rail|train ticket/i, 'metro'], [/petrol|fuel|diesel|hpcl|bpcl|iocl|shell/i, 'fuel'],
    [/amazon|flipkart|myntra|ajio|meesho|shopkart|cartly/i, 'online'], [/netflix|spotify|prime video|hotstar|youtube|apple\.com|google play|streamflix|subscription/i, 'streaming'],
    [/movie|cinema|pvr|inox|bookmyshow|concert|event/i, 'movies'], [/pharma|medic|chemist|apollo|1mg|netmeds/i, 'pharmacy'], [/hospital|clinic|doctor|diagnos|lab test/i, 'doctor'],
    [/gym|fitness|yoga|cult/i, 'gym'], [/insurance|lic\b|policy|premium/i, 'insurance'], [/salon|spa|barber|grooming/i, 'grooming'], [/book|course|udemy|coursera|tuition|school fee/i, 'education'],
    [/airline|flight|indigo|vistara|air india|makemytrip|goibibo|irctc/i, 'flights'], [/hotel|oyo|airbnb|stay/i, 'hotels'], [/emi|loan/i, 'emi_home'], [/tax|tds|gst pay/i, 'taxes'],
    [/charge|fee|penalty|late payment/i, 'fees'], [/donat|charity|foundation|ngo/i, 'charity'],
  ];
  LL.autoCategorize = (t) => {
    for (const [re, cat, type] of KEYWORDS) { if (type && type !== t.type) continue; if (!type && t.type === 'income') continue; if (re.test(t.payee || '')) { t.categoryId = 'cat_' + cat; return true; } }
    return false;
  };

  LL.Sample = {};
  LL.Sample.generate = function (endISO) {
    const R = U.rng(20261020);
    const rand = (a, b) => a + R() * (b - a);
    const chance = (p) => R() < p;
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const amt = (a, b, step = 1) => Math.round(rand(a, b) / step) * step;
    const time = (h0, h1) => { const m = Math.floor(rand(h0 * 60, h1 * 60)) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

    const end = endISO || U.today();
    const startYM = U.ymAdd(U.ym(end), -23);
    const start = startYM + '-01';
    const months = U.monthsBetween(startYM, U.ym(end));
    const mIndex = (iso) => months.indexOf(U.ym(iso));

    const accounts = [
      { id: 'acc_bank', name: 'Everyday Bank', type: 'bank', institution: 'Northwind Bank', opening: 140000, color: 's1', group: 'Liquid' },
      { id: 'acc_save', name: 'High-Yield Savings', type: 'savings', institution: 'Northwind Bank', opening: 450000, rate: 3.5, color: 's3', group: 'Liquid' },
      { id: 'acc_cash', name: 'Cash Wallet', type: 'cash', opening: 4000, color: 's4', group: 'Liquid' },
      { id: 'acc_cc1', name: 'Rewards Credit Card', type: 'credit', institution: 'Harbor Card Co.', opening: 0, limit: 300000, dueDay: 18, statementDay: 1, color: 's2', group: 'Cards' },
      { id: 'acc_cc2', name: 'Shopping Credit Card', type: 'credit', institution: 'Lumen Bank', opening: 0, limit: 150000, dueDay: 18, statementDay: 1, color: 's5', group: 'Cards' },
      { id: 'acc_broker', name: 'Brokerage & Funds', type: 'investment', institution: 'Meridian Securities', opening: 0, color: 's7', group: 'Investments' },
      { id: 'acc_fd', name: 'Fixed Deposits', type: 'investment', institution: 'Northwind Bank', opening: 0, color: 's6', group: 'Investments' },
      { id: 'acc_retire', name: 'Retirement (EPF + PPF)', type: 'retirement', opening: 0, color: 's8', group: 'Investments' },
      { id: 'acc_home', name: 'Apartment, Sector 21', type: 'property', opening: 0, color: 's1', group: 'Assets',
        valuations: months.map((m, i) => ({ date: m + '-01', value: Math.round(8200000 * Math.pow(1.0055, i)) })) },
      { id: 'acc_car', name: 'Hatchback (2023)', type: 'vehicle', opening: 0, color: 's4', group: 'Assets',
        valuations: months.map((m, i) => ({ date: m + '-01', value: Math.round(720000 * Math.pow(0.988, i)) })) },
    ].map((a) => ({ archived: false, includeInNetWorth: true, openingDate: start, currency: 'INR', ...a }));

    const txns = [];
    const bal = {}; accounts.forEach((a) => (bal[a.id] = a.opening));
    const tracked = new Set(['acc_bank', 'acc_save', 'acc_cash', 'acc_cc1', 'acc_cc2']);
    const add = (date, t, amount, type, accountId, cat, payee, extra = {}) => {
      amount = Math.round(amount);
      if (amount <= 0) return;
      const tx = { id: 'tx_' + (txns.length + 1).toString(36) + Math.floor(R() * 1e6).toString(36), date, time: t, amount, type, accountId, categoryId: 'cat_' + cat, payee, tags: extra.tags || [], notes: extra.notes || '', status: 'cleared' };
      if (type === 'transfer') tx.toAccountId = extra.to;
      if (extra.debtId) tx.debtId = extra.debtId;
      if (extra.holdingId) tx.holdingId = extra.holdingId;
      txns.push(tx);
      if (tracked.has(accountId)) bal[accountId] += type === 'income' ? amount : -amount;
      if (type === 'transfer' && tracked.has(extra.to)) bal[extra.to] += amount;
      return tx;
    };
    const payer = (big) => {
      if (bal.acc_bank < 20000) return chance(0.6) ? 'acc_cc1' : 'acc_cc2';
      const r = R();
      if (big) return r < 0.55 ? 'acc_cc1' : r < 0.85 ? 'acc_cc2' : 'acc_bank';
      return r < 0.5 ? 'acc_bank' : r < 0.82 ? 'acc_cc1' : 'acc_cc2';
    };

    /* ---------- loans (amortising) ---------- */
    const emi = (P, rate, n) => { const r = rate / 1200; return Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)); };
    const debts = [
      { id: 'debt_home', name: 'Home Loan', kind: 'owed', type: 'mortgage', lender: 'Northwind Bank', principal: 4500000, rate: 8.5, tenure: 240, startDate: U.addMonths(start, -36), emiDay: 5, categoryId: 'cat_emi_home', color: 's1' },
      { id: 'debt_car', name: 'Car Loan', kind: 'owed', type: 'auto', lender: 'Lumen Bank', principal: 800000, rate: 9.2, tenure: 60, startDate: U.addMonths(start, -14), emiDay: 10, categoryId: 'cat_emi_car', color: 's4' },
      { id: 'debt_lent', name: 'Lent to Rohan (laptop)', kind: 'lent', type: 'personal', lender: 'Rohan M.', principal: 25000, rate: 0, tenure: 0, startDate: U.addMonths(start, 15), balanceManual: 15000, color: 's3', notes: 'Paying back 5,000 a month' },
    ];
    debts.forEach((d) => { if (d.tenure) d.emi = emi(d.principal, d.rate, d.tenure); });

    /* ---------- market paths ---------- */
    const walk = (p0, drift, vol, shock = {}) => {
      let p = p0;
      return months.map((m, i) => { if (i) p *= 1 + drift + (R() - 0.5) * 2 * vol + (shock[i] || 0); return { ym: m, price: U.round(p, 2) }; });
    };
    const crash = { 9: -0.07, 10: -0.04, 17: 0.05 };
    const holdings = [
      { id: 'h_nifty', accountId: 'acc_broker', name: 'Nifty 50 Index Fund', symbol: 'N50IDX', type: 'Mutual Fund', sector: 'Large Cap', region: 'India', sip: 10000, sipDay: 12, history: walk(182, 0.011, 0.035, crash), opening: 350000 },
      { id: 'h_flexi', accountId: 'acc_broker', name: 'Flexi Cap Growth Fund', symbol: 'FLXCAP', type: 'Mutual Fund', sector: 'Multi Cap', region: 'India', sip: 7500, sipDay: 12, history: walk(61.4, 0.013, 0.045, crash), opening: 180000 },
      { id: 'h_elss', accountId: 'acc_broker', name: 'ELSS Tax Saver Fund', symbol: 'ELSS80C', type: 'Mutual Fund', sector: 'Multi Cap', region: 'India', sip: 3000, sipDay: 12, history: walk(94, 0.012, 0.045, crash), opening: 60000, tags: ['tax-80C'] },
      { id: 'h_intl', accountId: 'acc_broker', name: 'US Total Market FoF', symbol: 'USTMKT', type: 'Mutual Fund', sector: 'International', region: 'United States', sip: 0, history: walk(28.5, 0.012, 0.04), opening: 120000 },
      { id: 'h_info', accountId: 'acc_broker', name: 'Infotech Systems Ltd', symbol: 'INFOSYS', type: 'Stock', sector: 'Technology', region: 'India', history: walk(1520, 0.006, 0.06, crash), buys: [[1, 40]] },
      { id: 'h_bank', accountId: 'acc_broker', name: 'National Commerce Bank', symbol: 'NCBANK', type: 'Stock', sector: 'Financials', region: 'India', history: walk(1610, 0.009, 0.05, crash), buys: [[2, 60]] },
      { id: 'h_power', accountId: 'acc_broker', name: 'Gridline Power Corp', symbol: 'GRIDPWR', type: 'Stock', sector: 'Utilities', region: 'India', history: walk(281, 0.017, 0.055), buys: [[4, 150]] },
      { id: 'h_fmcg', accountId: 'acc_broker', name: 'Hearth Consumer Brands', symbol: 'HEARTH', type: 'Stock', sector: 'Consumer', region: 'India', history: walk(2450, 0.002, 0.04), buys: [[6, 25]] },
      { id: 'h_gold', accountId: 'acc_broker', name: 'Gold ETF', symbol: 'GOLDETF', type: 'Gold', sector: 'Commodities', region: 'Global', history: walk(52.1, 0.019, 0.03), buys: [[3, 400]] },
      { id: 'h_btc', accountId: 'acc_broker', name: 'Bitcoin', symbol: 'BTC', type: 'Crypto', sector: 'Crypto', region: 'Global', history: walk(5200000, 0.028, 0.12), buys: [[8, 0.012]] },
      { id: 'h_fd', accountId: 'acc_fd', name: 'Fixed Deposit · 3 yr', symbol: 'FD-7.1', type: 'Fixed Deposit', sector: 'Debt', region: 'India', rate: 7.1, maturity: U.addMonths(start, 36), history: months.map((m, i) => ({ ym: m, price: U.round(Math.pow(1 + 0.071 / 12, i), 4) })), opening: 200000 },
      { id: 'h_ppf', accountId: 'acc_retire', name: 'Public Provident Fund', symbol: 'PPF', type: 'Retirement', sector: 'Debt', region: 'India', rate: 7.1, sip: 5000, sipDay: 15, history: months.map((m, i) => ({ ym: m, price: U.round(Math.pow(1 + 0.071 / 12, i), 4) })), opening: 410000, tags: ['tax-80C'] },
      { id: 'h_epf', accountId: 'acc_retire', name: 'Employee Provident Fund', symbol: 'EPF', type: 'Retirement', sector: 'Debt', region: 'India', rate: 8.25, history: months.map((m, i) => ({ ym: m, price: U.round(Math.pow(1 + 0.0825 / 12, i), 4) })), opening: 620000, payroll: 9800 },
    ];
    holdings.forEach((h) => { h.flows = []; h.price = h.history[h.history.length - 1].price; });
    const priceAt = (h, iso) => { const i = Math.max(0, mIndex(iso)); return h.history[i].price; };
    const buy = (h, date, amount, units) => { const p = priceAt(h, date); h.flows.push({ date, amount: Math.round(amount), units: units != null ? units : amount / p, price: p }); };
    holdings.forEach((h) => { if (h.opening) buy(h, start, h.opening); });

    /* ---------- recurring bill & subscription definitions ---------- */
    const bills = [
      { id: 'bill_maint', name: 'Society Maintenance', kind: 'bill', amount: 3500, categoryId: 'cat_maintenance', accountId: 'acc_bank', frequency: 'monthly', dueDay: 7, autopay: true },
      { id: 'bill_power', name: 'City Power Electricity', kind: 'bill', amount: 2100, variable: true, categoryId: 'cat_electricity', accountId: 'acc_bank', frequency: 'monthly', dueDay: 20, autopay: false },
      { id: 'bill_net', name: 'FiberNet Broadband', kind: 'bill', amount: 999, categoryId: 'cat_internet', accountId: 'acc_cc1', frequency: 'monthly', dueDay: 3, autopay: true },
      { id: 'bill_mobile', name: 'Skyline Mobile Postpaid', kind: 'bill', amount: 599, categoryId: 'cat_mobile', accountId: 'acc_cc1', frequency: 'monthly', dueDay: 22, autopay: true },
      { id: 'bill_gas', name: 'Metro Gas & Water', kind: 'bill', amount: 780, variable: true, categoryId: 'cat_water_gas', accountId: 'acc_bank', frequency: 'monthly', dueDay: 25, autopay: false },
      { id: 'sub_flix', name: 'StreamFlix Premium', kind: 'subscription', amount: 649, categoryId: 'cat_streaming', accountId: 'acc_cc2', frequency: 'monthly', dueDay: 8, autopay: true, priceHistory: [{ from: start, amount: 499 }, { from: months[14] + '-01', amount: 649 }] },
      { id: 'sub_music', name: 'Tunewave Music', kind: 'subscription', amount: 119, categoryId: 'cat_streaming', accountId: 'acc_cc2', frequency: 'monthly', dueDay: 15, autopay: true },
      { id: 'sub_cloud', name: 'CloudBox 200 GB', kind: 'subscription', amount: 219, categoryId: 'cat_streaming', accountId: 'acc_cc1', frequency: 'monthly', dueDay: 2, autopay: true, priceHistory: [{ from: start, amount: 130 }, { from: months[19] + '-01', amount: 219 }] },
      { id: 'sub_vid', name: 'VidPrime Annual', kind: 'subscription', amount: 1499, categoryId: 'cat_streaming', accountId: 'acc_cc2', frequency: 'yearly', dueDay: 14, dueMonth: (+months[2].slice(5)) , autopay: true },
      { id: 'sub_gym', name: 'IronHouse Gym', kind: 'subscription', amount: 2200, categoryId: 'cat_gym', accountId: 'acc_bank', frequency: 'monthly', dueDay: 1, autopay: true, lastUsed: U.addDays(end, -52), notes: 'Check-ins dropped off this quarter' },
      { id: 'sub_news', name: 'The Daily Ledger (news)', kind: 'subscription', amount: 299, categoryId: 'cat_streaming', accountId: 'acc_cc1', frequency: 'monthly', dueDay: 11, autopay: true, startDate: months[18] + '-01' },
      { id: 'sub_design', name: 'Canvas Pro (design app)', kind: 'subscription', amount: 499, categoryId: 'cat_streaming', accountId: 'acc_cc2', frequency: 'monthly', dueDay: 27, autopay: true, startDate: months[21] + '-01', trialEnds: U.addDays(end, 6) },
      { id: 'bill_health', name: 'Family Health Insurance', kind: 'bill', amount: 24000, categoryId: 'cat_insurance', accountId: 'acc_cc1', frequency: 'yearly', dueDay: 9, dueMonth: +months[4].slice(5), autopay: false, tags: ['tax-80D'] },
      { id: 'bill_term', name: 'Term Life Insurance', kind: 'bill', amount: 14500, categoryId: 'cat_insurance', accountId: 'acc_bank', frequency: 'yearly', dueDay: 16, dueMonth: +months[9].slice(5), autopay: true, tags: ['tax-80C'] },
      { id: 'bill_carins', name: 'Car Insurance', kind: 'bill', amount: 18200, categoryId: 'cat_insurance', accountId: 'acc_cc1', frequency: 'yearly', dueDay: 21, dueMonth: +months[6].slice(5), autopay: false },
      { id: 'bill_emi_home', name: 'Home Loan EMI', kind: 'bill', amount: debts[0].emi, categoryId: 'cat_emi_home', accountId: 'acc_bank', frequency: 'monthly', dueDay: 5, autopay: true, debtId: 'debt_home' },
      { id: 'bill_emi_car', name: 'Car Loan EMI', kind: 'bill', amount: debts[1].emi, categoryId: 'cat_emi_car', accountId: 'acc_bank', frequency: 'monthly', dueDay: 10, autopay: true, debtId: 'debt_car' },
      { id: 'bill_sip', name: 'Mutual Fund SIPs', kind: 'bill', amount: 20500, categoryId: 'cat_invest', accountId: 'acc_bank', frequency: 'monthly', dueDay: 12, autopay: true, transferTo: 'acc_broker' },
      { id: 'bill_ppf', name: 'PPF Contribution', kind: 'bill', amount: 5000, categoryId: 'cat_invest', accountId: 'acc_bank', frequency: 'monthly', dueDay: 15, autopay: false, transferTo: 'acc_retire', tags: ['tax-80C'] },
    ].map((b) => ({ active: true, startDate: start, tags: [], notes: '', ...b }));
    const billAmountAt = (b, iso) => { if (!b.priceHistory) return b.amount; let a = b.amount; for (const p of b.priceHistory) if (iso >= p.from) a = p.amount; return a; };

    /* ---------- merchants ---------- */
    const M = {
      groceries: ['FreshBasket', 'Daily Greens Market', 'QuickMart Express', 'Organic Corner', 'Neighbourhood Kirana'],
      delivery: ['FeastFleet', 'TiffinTap', 'Biryani Box', 'Pizza Planet', 'Wok Express'],
      dining: ['The Copper Pot', 'Saffron Table', 'Sushi Lane', 'Brew Garden', 'Coastal Kitchen', 'Tandoor Tales'],
      coffee: ['Bean There', 'Third Wave Café', 'Chai Corner', 'Bakehouse 9'],
      cabs: ['QuickRide', 'AutoGo', 'CityCab'],
      online: ['ShopKart', 'Cartly', 'BuyNest', 'StyleHub'],
      clothing: ['Thread & Loom', 'UrbanFit Store', 'StyleHub'],
      home_kitchen: ['HomeNest', 'KitchenCraft', 'ShopKart'],
      movies: ['CineMax Multiplex', 'StageDoor Events', 'Galaxy Screens'],
      games: ['PixelPlay Store', 'Hobby Hive'],
      pharmacy: ['WellCare Pharmacy', 'MedPlus Corner'],
      grooming: ['Clip & Co.', 'Glow Salon'],
      education: ['PageTurn Books', 'LearnLoop Online'],
    };

    const trips = [
      { mi: 2, name: 'Goa', days: 4, flights: 16800, hotel: 21000 },
      { mi: 7, name: 'Manali', days: 5, flights: 12400, hotel: 18500 },
      { mi: 14, name: 'Kerala', days: 5, flights: 19800, hotel: 26500 },
      { mi: 20, name: 'Jaipur', days: 3, flights: 9800, hotel: 14200 },
    ];
    const tripByMonth = {}; trips.forEach((t) => (tripByMonth[t.mi] = t));
    const ccStatement = { acc_cc1: 0, acc_cc2: 0 };

    /* ---------- day loop ---------- */
    let day = start;
    while (day <= end) {
      const d = U.d(day), dom = d.getDate(), dow = d.getDay(), mi = mIndex(day), mon = d.getMonth() + 1;
      const weekend = dow === 0 || dow === 6;
      const creep = 1 + mi * 0.018; // lifestyle creep
      const festive = mon === 10 || mon === 11;
      const dim = U.daysInMonth(U.ym(day));

      if (dom === 1) {
        // salary (raise at month 13), statement snapshot for cards
        const salary = mi >= 13 ? 212000 : 188000;
        add(day, '09:05', salary, 'income', 'acc_bank', 'salary', 'Acme Analytics Pvt Ltd', { notes: 'Net salary after TDS', tags: [] });
        ccStatement.acc_cc1 = -bal.acc_cc1; ccStatement.acc_cc2 = -bal.acc_cc2;
      }
      if (dom === 2 && bal.acc_bank > 180000) {
        const mv = Math.floor((bal.acc_bank - 130000) / 5000) * 5000;
        add(day, '10:12', mv, 'transfer', 'acc_bank', 'transfer', 'Move to savings', { to: 'acc_save' });
      }
      // fixed bills
      for (const b of bills) {
        if (!b.active || day < b.startDate) continue;
        const due = Math.min(b.dueDay, dim);
        if (dom !== due) continue;
        if (b.frequency === 'yearly' && mon !== b.dueMonth) continue;
        let a = billAmountAt(b, day);
        if (b.id === 'bill_power') a = Math.round(1700 * ([4, 5, 6].includes(mon) ? 2.3 : [7, 8, 9].includes(mon) ? 1.5 : [12, 1].includes(mon) ? 0.9 : 1.1) * rand(0.88, 1.15));
        if (b.id === 'bill_gas') a = Math.round(700 * rand(0.85, 1.25));
        if (b.transferTo) {
          add(day, '06:30', a, 'transfer', b.accountId, 'invest', b.name, { to: b.transferTo, tags: b.tags });
          if (b.id === 'bill_sip') holdings.filter((h) => h.sip && h.accountId === 'acc_broker').forEach((h) => buy(h, day, h.sip));
          if (b.id === 'bill_ppf') buy(holdings.find((h) => h.id === 'h_ppf'), day, 5000);
          continue;
        }
        add(day, b.autopay ? '07:00' : time(18, 22), a, 'expense', b.accountId, b.categoryId.slice(4), b.name, { tags: b.tags, debtId: b.debtId });
      }
      if (dom === 1) buy(holdings.find((h) => h.id === 'h_epf'), day, 9800);
      // card payments
      if (dom === 18) {
        ['acc_cc1', 'acc_cc2'].forEach((c) => { if (ccStatement[c] > 0) add(day, '11:40', Math.min(ccStatement[c], -bal[c]), 'transfer', 'acc_bank', 'cc_payment', 'Card bill payment', { to: c }); });
      }
      // stock / gold / crypto buys
      holdings.forEach((h) => (h.buys || []).forEach(([bm, units]) => {
        if (bm === mi && dom === 6) { const p = priceAt(h, day), a = Math.round(units * p); add(day, '10:20', a, 'transfer', 'acc_bank', 'invest', 'Buy ' + h.name, { to: 'acc_broker', holdingId: h.id }); buy(h, day, a, units); }
      }));
      if (dom === 28 && mi % 3 === 2) add(day, '08:00', Math.round(bal.acc_save * 0.035 / 4), 'income', 'acc_save', 'interest', 'Savings interest credit');
      if (dom === 24 && [3, 9, 15, 21].includes(mi)) add(day, '09:30', amt(2200, 4800, 10), 'income', 'acc_bank', 'dividends', 'Dividend · ' + pick(['Infotech Systems', 'National Commerce Bank', 'Gridline Power']));
      if (dom === 16 && chance(0.4)) add(day, '15:10', amt(18000, 65000, 500), 'income', 'acc_bank', 'freelance', pick(['Brightline Studio', 'Kite Labs', 'Orbit Media']), { notes: 'Dashboard consulting', tags: ['freelance'] });
      if (mi >= 15 && dom === 5 && mi <= 17) add(day, '20:00', 5000, 'income', 'acc_bank', 'refunds', 'Rohan M. (repayment)', { notes: 'Loan repayment' });

      // ---- variable spending ----
      if (chance(weekend ? 0.36 : 0.17)) add(day, time(9, 20), amt(600, 3000, 10) * (festive ? 1.2 : 1), 'expense', payer(), 'groceries', pick(M.groceries));
      if (chance(0.3 * creep * (weekend ? 1.3 : 1))) add(day, time(19.5, 23.6), amt(240, 880, 5), 'expense', payer(), 'delivery', pick(M.delivery));
      if (weekend && chance(0.4 * Math.min(creep, 1.35))) add(day, time(13, 22.5), amt(1100, 3000, 10) * Math.min(creep, 1.4), 'expense', payer(true), 'dining', pick(M.dining));
      if (!weekend && chance(0.45)) add(day, time(8, 11.5), amt(140, 360, 5), 'expense', chance(0.35) ? 'acc_cash' : 'acc_bank', 'coffee', pick(M.coffee));
      if (chance(0.3)) add(day, time(7.5, 22), amt(110, 620, 1), 'expense', 'acc_bank', 'cabs', pick(M.cabs), { tags: !weekend && chance(0.25) ? ['reimbursable', 'work'] : [] });
      if (dow === 6 && chance(0.85)) add(day, time(8, 19), amt(1800, 3200, 50), 'expense', 'acc_cc1', 'fuel', 'FuelPoint Station');
      if (!weekend && chance(0.18)) add(day, time(8, 10), amt(40, 90, 5), 'expense', 'acc_cash', 'metro', 'Metro Rail');
      if (chance(festive ? 0.18 : 0.065)) add(day, chance(0.25) ? time(23, 25.8) : time(12, 23), amt(450, 5200, 10) * (festive ? 1.6 : 1), 'expense', payer(true), 'online', pick(M.online), { tags: festive ? ['festive'] : [] });
      if (chance(festive ? 0.08 : 0.035)) add(day, time(12, 21), amt(900, 4800, 10), 'expense', payer(true), 'clothing', pick(M.clothing), { tags: festive ? ['festive'] : [] });
      if (chance(0.015)) add(day, time(11, 21), amt(600, 5000, 10), 'expense', payer(true), 'home_kitchen', pick(M.home_kitchen));
      if (weekend && chance(0.2)) add(day, time(15, 22), amt(560, 1400, 10), 'expense', payer(), 'movies', pick(M.movies));
      if (chance(0.025)) add(day, time(19, 24), amt(400, 3200, 10), 'expense', payer(), 'games', pick(M.games));
      if (chance(0.05)) add(day, time(10, 21), amt(180, 1400, 5), 'expense', payer(), 'pharmacy', pick(M.pharmacy), { tags: ['medical'] });
      if (chance(0.012)) add(day, time(10, 18), amt(800, 1800, 50), 'expense', 'acc_bank', 'doctor', 'Sunrise Clinic', { tags: ['medical'] });
      if (chance(0.035)) add(day, time(11, 20), amt(350, 1600, 10), 'expense', payer(), 'grooming', pick(M.grooming));
      if (chance(0.02)) add(day, time(20, 23), amt(350, 4800, 10), 'expense', payer(), 'education', pick(M.education));
      if (dom === 10) add(day, '10:00', 1000, 'expense', 'acc_bank', 'charity', 'Hope Foundation', { tags: ['tax-80G'] });
      if ((festive && chance(0.06)) || chance(0.01)) add(day, time(12, 21), amt(800, 6000, 100), 'expense', payer(true), 'gifts_out', pick(['Giftly', 'Sweets & Co.', 'ShopKart']), { tags: festive ? ['festive'] : [] });
      if (!weekend && chance(0.12)) add(day, time(16, 21), amt(40, 260, 5), 'expense', 'acc_cash', 'coffee', 'Street Snacks');
      if (bal.acc_bank < 25000 && bal.acc_save > 100000) add(day, '08:45', 60000, 'transfer', 'acc_save', 'transfer', 'Top-up from savings', { to: 'acc_bank' });
      if (bal.acc_cash < 1200) add(day, time(10, 19), 5000, 'transfer', 'acc_bank', 'atm', 'ATM withdrawal', { to: 'acc_cash' });
      if (chance(0.06)) add(day, time(9, 20), amt(15, 50, 1) * 10, 'income', payer() === 'acc_bank' ? 'acc_bank' : 'acc_cc1', 'refunds', pick(['ShopKart refund', 'Cashback reward', 'Cartly return']));

      // trips
      const trip = tripByMonth[mi];
      if (trip) {
        const tag = ['vacation-' + trip.name.toLowerCase()];
        if (dom === 3) { add(day, '22:14', trip.flights, 'expense', 'acc_cc1', 'flights', 'SkyHop Airlines', { tags: tag }); add(day, '22:40', trip.hotel, 'expense', 'acc_cc1', 'hotels', 'StayEasy · ' + trip.name, { tags: tag }); }
        if (dom >= 18 && dom < 18 + trip.days) for (let k = 0; k < 3; k++) add(day, time(9, 23), amt(400, 3800, 10), 'expense', payer(true), 'trip_misc', pick(['Beach Shack', 'Local Taxi', 'Souvenir Stall', 'Hill Café', 'Heritage Tour', 'Spice Market']) + ' · ' + trip.name, { tags: tag });
      }
      // one-off anomalies
      if (mi === 9 && dom === 13) add(day, '02:10', 48000, 'expense', 'acc_cc1', 'doctor', 'City General Hospital', { notes: 'Emergency visit; claim filed', tags: ['medical', 'tax-80D'] });
      if (mi === 16 && dom === 9) add(day, '21:35', 124990, 'expense', 'acc_cc1', 'electronics', 'TechWorld Electronics', { notes: 'New laptop, 12-month warranty' });
      if (mi === 12 && dom === 19) add(day, '16:00', 22400, 'expense', 'acc_bank', 'car_service', 'AutoCare Garage', { notes: 'Clutch plate + annual service' });
      if (mon === 3 && dom === 14) add(day, '12:00', amt(18000, 26000, 100), 'expense', 'acc_bank', 'taxes', 'Advance tax payment', { notes: 'Final instalment' });
      if (mi === 11 && dom === 19) add(day, '09:00', 1180, 'expense', 'acc_cc2', 'fees', 'Late payment fee', { notes: 'Missed the due date by 2 days' });
      if (dom === 4 && chance(0.3)) add(day, '09:00', amt(20, 120, 1), 'expense', 'acc_bank', 'fees', 'SMS & debit card charges');
      if (mi % 4 === 1 && dom === 20) add(day, time(10, 17), amt(2500, 6500, 100), 'expense', 'acc_bank', 'car_service', 'AutoCare Garage');

      day = U.addDays(day, 1);
    }
    // recent card spends still pending
    txns.forEach((t) => { if (t.date >= U.addDays(end, -2) && (t.accountId === 'acc_cc1' || t.accountId === 'acc_cc2')) t.status = 'pending'; });
    txns.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));

    // finalise holdings
    holdings.forEach((h) => { h.units = U.round(U.sum(h.flows, (f) => f.units), 6); delete h.buys; delete h.opening; });

    const budgets = [
      ['groceries', 16000], ['dining', 9000], ['delivery', 6000], ['coffee', 3000], ['cabs', 4200], ['fuel', 11000],
      ['online', 8000], ['clothing', 4000], ['movies', 2200], ['pharmacy', 2000], ['grooming', 1500], ['electricity', 3200],
      ['streaming', 2000], ['games', 1000], ['education', 2000], ['gifts_out', 2500],
    ].map(([c, a]) => ({ id: 'bud_' + c, categoryId: 'cat_' + c, amount: a, period: 'monthly', rollover: ['groceries', 'clothing', 'gifts_out'].includes(c) }));

    const goals = [
      { id: 'goal_emerg', name: 'Emergency fund (6 months)', target: 600000, saved: 412000, deadline: U.addMonths(end, 8), monthly: 25000, color: 's3', icon: 'shield', accountId: 'acc_save' },
      { id: 'goal_europe', name: 'Europe trip, summer', target: 350000, saved: 128000, deadline: U.addMonths(end, 9), monthly: 22000, color: 's1', icon: 'flow' },
      { id: 'goal_car', name: 'Next car down payment', target: 400000, saved: 65000, deadline: U.addMonths(end, 24), monthly: 12000, color: 's4', icon: 'car' },
      { id: 'goal_reno', name: 'Kitchen renovation', target: 250000, saved: 250000, deadline: U.addMonths(end, -1), monthly: 0, color: 's6', icon: 'house' },
      { id: 'goal_kid', name: 'Child education corpus', target: 2500000, saved: 310000, deadline: U.addMonths(end, 144), monthly: 8000, color: 's7', icon: 'target' },
    ].map((g) => {
      // synthetic contribution history for charts
      const hist = []; let s = g.saved;
      for (let i = 0; i < 12; i++) { hist.unshift({ ym: U.ymAdd(U.ym(end), -i), saved: Math.max(0, Math.round(s)) }); s -= g.monthly ? g.monthly * rand(0.6, 1.3) : g.target / 12; }
      return { ...g, history: hist, createdAt: start };
    });

    const rules = [
      ['FeastFleet', 'delivery'], ['TiffinTap', 'delivery'], ['QuickRide', 'cabs'], ['AutoGo', 'cabs'], ['FreshBasket', 'groceries'],
      ['FuelPoint', 'fuel'], ['StreamFlix', 'streaming'], ['ShopKart', 'online'], ['Metro Rail', 'metro'], ['Bean There', 'coffee'],
      ['Salary', 'salary'], ['ATM', 'atm'],
    ].map(([v, c], i) => ({ id: 'rule_' + i, field: 'payee', op: 'contains', value: v, categoryId: 'cat_' + c, tags: [], active: true }));

    return {
      meta: { id: 'meta', version: 1, currency: 'INR', householdName: 'The Sharma household (sample)', isSample: true, createdAt: new Date().toISOString(), monthStartDay: 1, fyStartMonth: 4, generatedFor: end },
      accounts, categories: LL.defaultCategories(), transactions: txns, budgets, bills, goals, debts, holdings, rules, documents: [],
    };
  };

  LL.Sample.empty = function () {
    return {
      meta: { id: 'meta', version: 1, currency: 'INR', householdName: 'My money', isSample: false, createdAt: new Date().toISOString(), monthStartDay: 1, fyStartMonth: 4 },
      accounts: [{ id: 'acc_main', name: 'Main Account', type: 'bank', opening: 0, openingDate: U.today(), color: 's1', group: 'Liquid', archived: false, includeInNetWorth: true, currency: 'INR' },
                 { id: 'acc_cashw', name: 'Cash', type: 'cash', opening: 0, openingDate: U.today(), color: 's4', group: 'Liquid', archived: false, includeInNetWorth: true, currency: 'INR' }],
      categories: LL.defaultCategories(), transactions: [], budgets: [], bills: [], goals: [], debts: [], holdings: [], rules: [], documents: [],
    };
  };
})(window.LL);

export const KEYWORDS = {
  Earning: ['got paid', 'salary', 'freelance', 'earned', 'income', 'bonus', 'refund', 'received', 'payment received'],
  Payments: ['bill', 'fee', 'fees', 'gym', 'rent', 'internet', 'icloud', 'subscription', 'tuition', 'training', 'electricity', 'insurance', 'installment'],
  Coffee: ['coffee', 'latte', 'cappuccino', 'espresso', 'starbucks'],
  Food: ['lunch', 'dinner', 'breakfast', 'food', 'pizza', 'burger', 'biryani', 'restaurant', 'groceries', 'snack', 'snacks', 'kfc', 'mcdonalds'],
  Transport: ['uber', 'careem', 'fuel', 'petrol', 'taxi', 'rickshaw', 'bus', 'parking', 'ride', 'metro', 'bykea']
};

const FILLERS = ['and', 'with', 'owes', 'owe', 'me', 'split', 'each', 'to'];
const CURRENCY = ['rs', 'pkr', 'rupee', 'rupees', 'rupaye'];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function toNumber(tok) {
  const m = /^(?:rs|pkr)?\.?(\d+(?:\.\d+)?)(k)?$/i.exec(tok);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1));
}

function pickCategory(text, keywords) {
  const low = text.toLowerCase();
  for (const [cat, words] of Object.entries(keywords)) {
    if (words.some(w => new RegExp('\\b' + w + '\\b').test(low))) return cat;
  }
  return 'Others';
}

export function parseEntry(text, keywords = KEYWORDS) {
  const clean = String(text)
    .replace(/(\d),(?=\d{3}(\D|$))/g, '$1')
    .replace(/([A-Za-z])[,:](\d)/g, '$1 $2');
  const tokens = clean
    .split(/\s+/)
    .map(t => t.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, ''))
    .filter(t => t && !CURRENCY.includes(t.toLowerCase()));

  const first = tokens.findIndex(t => toNumber(t) !== null);
  if (first === -1) return { amount: 0, category: 'Others', note: '', friends: [], error: 'No amount found' };

  const amount = toNumber(tokens[first]);
  const noteWords = tokens.slice(0, first).filter(t => !FILLERS.includes(t.toLowerCase()));
  const friends = [];
  let pending = [];

  tokens.slice(first + 1).forEach(t => {
    const n = toNumber(t);
    if (n === null) {
      if (!FILLERS.includes(t.toLowerCase())) pending.push(t);
      return;
    }
    const name = pending.pop();
    noteWords.push(...pending);
    friends.push({ name: name ? cap(name) : '', amount: n });
    pending = [];
  });
  noteWords.push(...pending);

  const category = pickCategory(tokens.join(' '), keywords);
  return {
    amount,
    category,
    note: noteWords.join(' '),
    friends: category === 'Earning' ? [] : friends,
    error: ''
  };
}

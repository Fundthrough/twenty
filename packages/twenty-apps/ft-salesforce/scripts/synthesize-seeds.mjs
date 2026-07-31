// Rewrites scripts/data/seed-*.jsonl in place, replacing every identifying value with
// synthetic data while preserving field names and the distribution of categorical /
// numeric fields, so seed-local.mjs and seed-demo.mjs still exercise the same mappings.
import { readFileSync, writeFileSync } from 'node:fs';

// deterministic PRNG so re-running produces identical output (no git churn)
let seed = 20260731;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const FIRST = ['Ada','Bruno','Camila','Dmitri','Elena','Farid','Greta','Hugo','Iris','Jonas','Kaya','Leif','Mira','Noor','Otto','Priya','Quinn','Rosa','Sven','Tara','Umi','Vera','Wren','Xavi','Yuki','Zane'];
const LAST = ['Almeida','Bergstrom','Castellan','Duvall','Eriksen','Fontaine','Gallardo','Halvorsen','Ibarra','Jensen','Kowalski','Lindqvist','Moreau','Nakamura','Okonkwo','Petrov','Quintero','Rasmussen','Solberg','Tanaka','Ueda','Vasquez','Wexler','Ximenes','Yamada','Zielinski'];
const CO_A = ['Northwind','Brightpath','Cedarline','Dockside','Everpeak','Foundry','Granite','Harborview','Ironwood','Junction','Keystone','Lakeshore','Meridian','Northgate','Oakfield','Pinecrest','Quarry','Ridgeway','Summit','Trailhead','Uplands','Vantage','Westbrook','Yardley'];
const CO_B = ['Logistics','Contracting','Fabrication','Transport','Services','Industrial','Supply','Mechanical','Electrical','Freight','Builders','Solutions','Partners','Group','Works','Systems'];
const CO_C = ['LLC','Inc.','Ltd.','Corp.','LLP',''];
const STREETS = ['Example St','Sample Ave','Placeholder Rd','Testing Blvd','Fictional Way','Synthetic Dr'];
const CITIES = [['Springfield','IL','62701'],['Riverton','UT','84065'],['Fairview','OR','97024'],['Georgetown','TX','78626'],['Milton','ON','L9T 2X5'],['Ashfield','NS','B0J 1T0']];

const makePerson = (i) => {
  const first = pick(FIRST), last = pick(LAST);
  const suffix = pick(CO_C);
  return {
    first, last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    // 555-01xx is reserved for fiction, so these can never reach a real line
    phone: `+1206555${String(100 + (i % 100)).padStart(4, '0')}`,
    mobile: `+1206555${String(100 + ((i * 7) % 100)).padStart(4, '0')}`,
    company: `${pick(CO_A)} ${pick(CO_B)}${suffix ? ' ' + suffix : ''}`,
  };
};

const sfId = (prefix, i) => `${prefix}${String(i).padStart(12, '0')}SYN`;

const rewrite = (path, kind) => {
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  const out = lines.map((line, i) => {
    const r = JSON.parse(line);
    const p = makePerson(i + 1);
    const set = (k, v) => { if (k in r && r[k]) r[k] = v; };

    if (kind === 'lead') {
      if ('Id' in r) r.Id = sfId('00Q', i + 1);
      set('FirstName', p.first);
      set('LastName', p.last);
      set('Email', p.email);
      set('Phone', p.phone);
      set('MobilePhone', p.mobile);
      set('Company', p.company);
      set('Website', `https://www.${p.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`);
      set('Title', pick(['Owner','Controller','Operations Manager','President','Bookkeeper','CFO']));
      // real notes name people and describe accounts, so replace wholesale
      set('Account_Notes__c', 'Synthetic seed note: prior conversation about invoice funding timing.');
      set('Disqualified_Reason_Other__c', 'Synthetic seed detail');
      set('Lost_Reasons_Other__c', 'Synthetic seed detail');
      set('Renurture_Reason_Other__c', 'Synthetic seed detail');
      set('ConvertedContactId', sfId('003', i + 1));
      set('ConvertedAccountId', sfId('001', i + 1));
      set('Client_LKP__c', sfId('a0C', i + 1));
      set('Partner_Agent_ID__c', `AGENT-${1000 + i}`);
      set('Promo_Code__c', `PROMO${100 + (i % 20)}`);
    } else {
      if ('Id' in r) r.Id = sfId('a0C', i + 1);
      set('Name', `CL-${10000 + i}`);
      set('First_Name__c', p.first);
      set('Last_Name__c', p.last);
      set('Email__c', p.email);
      set('Phone__c', p.phone);
      set('Company_Name__c', p.company);
      set('PRO_Company_ID__c', String(500000 + i));
      set('Client_ID__c', String(700000 + i));
      set('Referring_Partner__c', `${pick(CO_A)} Partners`);
      const [city, state, postal] = pick(CITIES);
      set('Business_address_street__c', `${100 + i} ${pick(STREETS)}`);
      set('Business_address_city__c', city);
      set('Business_address_state__c', state);
      set('Business_address_postal_code__c', postal);
      // the SF query envelope embeds the real record id in its url
      if (r.attributes?.url) r.attributes = { ...r.attributes, url: `/services/data/v59.0/sobjects/Client__c/${r.Id}` };
    }
    return JSON.stringify(r);
  });
  writeFileSync(path, out.join('\n') + '\n');
  console.log(`${path}: ${out.length} records synthesized`);
};

rewrite('scripts/data/seed-leads.jsonl', 'lead');
rewrite('scripts/data/seed-clients.jsonl', 'client');

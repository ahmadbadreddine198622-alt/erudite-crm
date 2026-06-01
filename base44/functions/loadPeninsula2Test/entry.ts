import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROWS = [
  { full_name_en: "BASHEER MOHAMMAD SHAIK MASTHAN SAHEB", first_name: "BASHEER", last_name: "MOHAMMAD SHAIK MASTHAN SAHEB", phone: "+971525387464", additional_phones: [], email: "basheer.mohammad@gmail.com", nationality: "India", residence_country: "India", unit_reference: "202" },
  { full_name_en: "IRINA KULIKOVA", first_name: "IRINA", last_name: "KULIKOVA", phone: "+971509870177", additional_phones: [], email: "2949999@gmail.com", nationality: "Russian Federation", residence_country: "Russian Federation", unit_reference: "202" },
  { full_name_en: "ASTER ABRAHA", first_name: "ASTER", last_name: "ABRAHA", phone: "+971924312169", additional_phones: [], email: "emaylu@yahoo.com", nationality: "United States of America", residence_country: "United States of America", unit_reference: "205" },
  { full_name_en: "GULNARA KHALILOVA", first_name: "GULNARA", last_name: "KHALILOVA", phone: "+971545056886", additional_phones: [], email: "abid.mamedov@gmail.com", nationality: "Azerbaijan", residence_country: "Azerbaijan", unit_reference: "301" },
  { full_name_en: "RUSLAN MAMEDOV", first_name: "RUSLAN", last_name: "MAMEDOV", phone: "+971543227727", additional_phones: [], email: "abid.mamedov@gmail.com", nationality: "Azerbaijan", residence_country: "Azerbaijan", unit_reference: "305" },
  { full_name_en: "AMMAR ZEIN", first_name: "AMMAR", last_name: "ZEIN", phone: "+971501918956", additional_phones: ["+971500000123"], email: "ammarzeinbros@gmail.com", nationality: "Hungary", residence_country: "Hungary", unit_reference: "306" },
  { full_name_en: "ROMAN PETRENKO", first_name: "ROMAN", last_name: "PETRENKO", phone: "+971501040288", additional_phones: ["+971566529988", "+971508486398"], email: "develop@goldinvest.capital", nationality: "Ukraine", residence_country: "Ukraine", unit_reference: "307" },
  { full_name_en: "ANASTASIIA AVERINA", first_name: "ANASTASIIA", last_name: "AVERINA", phone: "+971525958462", additional_phones: [], email: "kozachuk@primerway.ru", nationality: "Russian Federation", residence_country: "Russian Federation", unit_reference: "308" },
  { full_name_en: "ANASTASIIA AVERINA", first_name: "ANASTASIIA", last_name: "AVERINA", phone: "+971525958462", additional_phones: [], email: "nishadk@altareshgov.com", nationality: "Russian Federation", residence_country: "Russian Federation", unit_reference: "308" },
  { full_name_en: "GULNARA KHALILOVA", first_name: "GULNARA", last_name: "KHALILOVA", phone: "+971545056886", additional_phones: [], email: "abid.mamedov@gmail.com", nationality: "Azerbaijan", residence_country: "Azerbaijan", unit_reference: "309" },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const created = [];
  const errors = [];

  for (const row of ROWS) {
    const record = {
      lead_type: "landlord_sale",
      full_name_en: row.full_name_en.trim().replace(/\s{2,}/g, ' '),
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      additional_phones: row.additional_phones,
      email: row.email.toLowerCase(),
      nationality: row.nationality,
      residence_country: row.residence_country,
      unit_reference: String(row.unit_reference).replace(/\.0$/, ''),
      project_id: "6a1808d8793c2b7606599f55",
      project_name: "Peninsula 2",
      source: "dld_lookup",
      stage: "initial_contact",
      stage_entered_at: now,
      assigned_agent_email: "ahmad@erudite-estate.com",
    };

    const result = await base44.asServiceRole.entities.Landlord.create(record);
    created.push({ id: result.id, full_name_en: record.full_name_en, unit_reference: record.unit_reference, email: record.email });
  }

  return Response.json({ inserted: created.length, records: created, errors });
});
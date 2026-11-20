import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { gbp, ukDate } from '@/lib/format';
import { LOGO_PNG_BASE64 } from '@/lib/logo';
import type { PayslipData } from '@/lib/payslip';

// The payslip PDF. Built from the same PayslipData as the screen. Built-in Helvetica only, so no font downloads.
const NAVY = '#1e3a8a';
const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  // The coat of arms is 292 x 318, so 36 x 39 keeps its shape.
  logo: { width: 36, height: 39, marginRight: 10 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY },
  subtitle: { fontSize: 9, color: '#475569' },
  draft: { backgroundColor: '#fef3c7', color: '#92400e', padding: 5, textAlign: 'center', marginBottom: 10, fontFamily: 'Helvetica-Bold' },
  box: { borderWidth: 1, borderColor: '#cbd5e1', padding: 8, marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '33%', marginBottom: 5 },
  label: { fontSize: 8, color: '#64748b', textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  total: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, fontFamily: 'Helvetica-Bold', backgroundColor: '#f1f5f9', paddingHorizontal: 4 },
  heading: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 8, marginBottom: 2 },
  net: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: NAVY, color: '#fff', padding: 8, marginTop: 10, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 8, color: '#475569', marginTop: 6 },
});

const Line = ({ label, amount, minus }: { label: string; amount: number; minus?: boolean }) => (
  <View style={s.row}>
    <Text>{label}</Text>
    <Text>{minus && amount > 0 ? '-' : ''}{gbp(amount)}</Text>
  </View>
);

export function PayslipPdf({ data }: { data: PayslipData }) {
  const e = data.employee;
  return (
    <Document title={`Payslip ${e.no} ${data.payDate}`} author="Government of Tristan da Cunha">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>
            <Image style={s.logo} src={`data:image/png;base64,${LOGO_PNG_BASE64}`} />
            <View>
              <Text style={s.title}>Government of Tristan da Cunha</Text>
              <Text style={s.subtitle}>Payslip</Text>
            </View>
          </View>
          <View>
            <Text>Pay date {ukDate(data.payDate)}</Text>
            <Text style={s.subtitle}>Period {ukDate(data.periodStart)} to {ukDate(data.periodEnd)}</Text>
          </View>
        </View>

        {data.draft && <Text style={s.draft}>DRAFT: this payroll run is not finalised. Figures may change.</Text>}

        <View style={s.box}>
          <View style={s.field}><Text style={s.label}>Employee</Text><Text>{e.name}</Text></View>
          <View style={s.field}><Text style={s.label}>Number</Text><Text>{e.no}</Text></View>
          <View style={s.field}><Text style={s.label}>Category</Text><Text>{data.categoryLabel}</Text></View>
          <View style={s.field}><Text style={s.label}>Department</Text><Text>{e.department}</Text></View>
          <View style={s.field}><Text style={s.label}>Grade</Text><Text>{e.grade}</Text></View>
          <View style={s.field}><Text style={s.label}>Job title</Text><Text>{e.jobTitle}</Text></View>
        </View>

        {data.partPeriod && (
          <Text style={s.note}>Part period: paid for {data.partPeriod.daysWorked} of {data.partPeriod.daysInPeriod} days.</Text>
        )}

        <Text style={s.heading}>Earnings</Text>
        {data.earnings.map((l) => <Line key={l.code} label={l.detail ? `${l.label} (${l.detail})` : l.label} amount={l.amount} />)}
        <View style={s.total}><Text>Total</Text><Text>{gbp(data.total)}</Text></View>

        <Text style={s.heading}>Deductions</Text>
        {data.deductions.map((l) => <Line key={l.code} label={l.label} amount={l.amount} minus />)}

        <View style={s.net}><Text>Net pay</Text><Text>{gbp(data.net)}</Text></View>

        <Text style={s.heading}>Year to date, tax year {data.ytd.taxYear}{data.draft ? ' (finalised payslips plus this one)' : ''}</Text>
        <Line label="Total pay" amount={data.ytd.totals.gross} />
        <Line label="Income tax" amount={data.ytd.totals.tax} />
        <Line label="Pension (employee)" amount={data.ytd.totals.pension} />
        <Line label="Net pay" amount={data.ytd.totals.net} />

        <Text style={s.note}>Employer pension contribution (paid by the employer, not deducted from you): {gbp(data.employerPension)}</Text>
        {data.creditCarriedForward > 0 && (
          <Text style={s.note}>Credit balance carried forward to the next pay: {gbp(data.creditCarriedForward)}</Text>
        )}

      </Page>
    </Document>
  );
}

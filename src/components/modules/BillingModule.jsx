import React, { useState, useMemo, useCallback } from 'react';
import { useAdmissionStore, getRoomDailyRate } from '../../store/admissionStore';
import './BillingModule.css';

/**
 * Format Clean Date helper for Billing Records
 * Formats timestamps cleanly as YYYY-MM-DD HH:mm AM/PM (e.g., 22-Oct-2026, 04:31 PM).
 */
function formatLedgerDate(dateVal) {
  if (!dateVal) dateVal = new Date();
  let d;
  if (typeof dateVal === 'string') {
    if (dateVal.toLowerCase().startsWith('today')) {
      const timePart = dateVal.replace(/today/i, '').trim();
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${monthNames[now.getMonth()]}-${now.getFullYear()}${timePart ? ', ' + timePart : ''}`;
    }
    d = new Date(dateVal);
  } else if (dateVal instanceof Date) {
    d = dateVal;
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? String(hours).padStart(2, '0') : '12';

  return `${day}-${month}-${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Memoized Counter Payment Form (3 fields only: Payer, Amount, Mode)
 */
const CounterPaymentForm = React.memo(function CounterPaymentForm({ onProcessPayment, defaultPayer }) {
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI / NetBanking');

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (!parsedAmt || parsedAmt <= 0) {
      alert('Please enter a valid payment amount greater than ₹0.');
      return;
    }
    const finalPayer = (payer || defaultPayer || 'Caregiver').trim();
    onProcessPayment({ payer: finalPayer, amount: parsedAmt, mode });
    setAmount('');
  };

  return (
    <form className="payment-collect-box" onSubmit={handleSubmit}>
      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>
        <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#10b981', marginRight: '6px' }}></i>
        Collect Counter Payment
      </div>

      <div className="payment-mode-group">
        {['UPI / NetBanking', 'Card', 'Cash'].map(m => (
          <label key={m} className="payment-mode-item">
            <input
              type="radio"
              name="paymentMode"
              value={m}
              checked={mode === m}
              onChange={(e) => setMode(e.target.value)}
            />
            <span>{m}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="payPayerName">Payer / Caregiver Name</label>
          <input
            id="payPayerName"
            type="text"
            className="form-control"
            placeholder={defaultPayer || "Enter Payer Name"}
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="payAmountInput">Amount to be Paid (₹)</label>
          <input
            id="payAmountInput"
            type="number"
            step="0.01"
            min="1"
            className="form-control"
            placeholder="₹0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      <button
        type="submit"
        className="quick-action-btn btn-discharge"
        style={{ width: '100%', marginTop: '10px' }}
      >
        <i className="fa-solid fa-circle-check"></i> Process Payment &amp; Recalculate
      </button>
    </form>
  );
});

export default function BillingModule() {
  // 1. Reception & Room Transfer Hook / Props Integration
  const {
    admissions,
    activeAdmission,
    selectedAdmissionId,
    setSelectedAdmissionId,
    activeTransferLogs
  } = useAdmissionStore();

  // Cashless Insurance & TPA Pipeline State
  const [tpaState, setTpaState] = useState({
    insurerName: 'Star Health and Allied Insurance',
    policyId: 'POL-8842-STAR',
    authId: 'AUTH-2026-99214',
    preAuthAmount: 50000,
    approvedAmount: 50000,
    copayAmount: 5000,
    pipelineStage: 'Approval Pending' // 'Claim Submitted' | 'Approval Pending' | 'Co-pay Pending' | 'Finalized'
  });

  // Advance Deposit Amount State
  const [advanceDeposit, setAdvanceDeposit] = useState(activeAdmission?.advanceDeposit || 5000);

  // Payments & Ledger State
  const [payments, setPayments] = useState([
    {
      txId: 'TXN-991823',
      date: '13-Aug-2026, 10:30 AM',
      method: 'UPI / NetBanking',
      payer: 'Sarah Vance (Caregiver)',
      amount: 10000,
      status: 'Paid'
    }
  ]);

  // Final Bill Generation Flag
  const [finalBillGenerated, setFinalBillGenerated] = useState(false);
  const [finalInvoiceNumber, setFinalInvoiceNumber] = useState('');

  // Print Draft Invoice Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Pushed Clinical Module Charges State (Read-only clinical charges)
  const clinicalCharges = useMemo(() => [
    {
      id: 'DOC-1',
      type: 'Service',
      name: 'Inpatient Cardiology Specialist Consultation',
      provider: 'Dr. Aris Thorne (Cardiology)',
      qty: 1,
      qtyDisplay: '1 Visit',
      rate: 12000,
      taxPercent: 0
    },
    {
      id: 'LAB-1',
      type: 'Lab',
      name: 'Troponin T Quantitative Cardiac Assay & CBC',
      provider: 'Central Diagnostics & Pathology Lab',
      qty: 1,
      qtyDisplay: '1 Test',
      rate: 8000,
      taxPercent: 0
    },
    {
      id: 'PHARM-1',
      type: 'Pharmacy',
      name: 'IV Ceftriaxone & Atorvastatin Medication Pack',
      provider: 'Central Inpatient Pharmacy',
      qty: 1,
      qtyDisplay: '1 Pack',
      rate: 8500,
      taxPercent: 5
    }
  ], []);

  // ===============================================================
  // 1. AUTOMATED STAY CALCULATOR & NO FLOATING DECIMALS
  // ===============================================================
  const calculatedRoomStayItems = useMemo(() => {
    if (!activeAdmission) return [];

    const transfers = [...activeTransferLogs].sort(
      (a, b) => new Date(a.transferDate || 0) - new Date(b.transferDate || 0)
    );

    const checkInDate = new Date(`${activeAdmission.admissionDate}T${activeAdmission.admissionTime || '09:00:00'}`);
    const validCheckIn = isNaN(checkInDate.getTime()) ? new Date(Date.now() - 3 * 86400000) : checkInDate;
    const now = new Date();
    const stayItems = [];

    if (transfers.length === 0) {
      const roomName = activeAdmission.roomNumber || 'General Ward A - Bed 1';
      const tariff = getRoomDailyRate(roomName);
      const totalHours = Math.max(1, Math.round((now.getTime() - validCheckIn.getTime()) / 3600000));
      const wholeDays = Math.floor(totalHours / 24);
      const remHours = totalHours % 24;

      // Human-readable stay formatting without decimal points
      const durationText = wholeDays > 0
        ? (remHours > 0 ? `${wholeDays} Days, ${remHours} Hours` : `${wholeDays} Days`)
        : `${remHours} Hours`;

      // Pro-rata integer days for billing calculation
      const billedDays = Math.max(1, Math.round(totalHours / 24));
      const subtotal = billedDays * tariff.rate;

      stayItems.push({
        id: 'STAY-1',
        type: 'Stay',
        name: `${roomName} Accommodation`,
        provider: 'Inpatient Nursing Service',
        qty: billedDays,
        qtyDisplay: durationText,
        rate: tariff.rate,
        taxPercent: 0,
        amount: subtotal
      });
    } else {
      let currentIn = validCheckIn;

      for (let i = 0; i < transfers.length; i++) {
        const t = transfers[i];
        const outTime = new Date(t.transferDate);
        const validOut = (!isNaN(outTime.getTime()) && outTime > currentIn)
          ? outTime
          : new Date(currentIn.getTime() + 86400000);

        const roomName = t.fromRoom || activeAdmission.roomNumber;
        const tariff = getRoomDailyRate(roomName);
        const totalHours = Math.max(1, Math.round((validOut.getTime() - currentIn.getTime()) / 3600000));
        const wholeDays = Math.floor(totalHours / 24);
        const remHours = totalHours % 24;

        const durationText = wholeDays > 0
          ? (remHours > 0 ? `${wholeDays} Days, ${remHours} Hours` : `${wholeDays} Days`)
          : `${remHours} Hours`;

        const billedDays = Math.max(1, Math.round(totalHours / 24));
        const subtotal = billedDays * tariff.rate;

        stayItems.push({
          id: `STAY-${i + 1}`,
          type: 'Stay',
          name: `${roomName} Accommodation (Transfer Leg ${i + 1})`,
          provider: 'Inpatient Nursing Service',
          qty: billedDays,
          qtyDisplay: durationText,
          rate: tariff.rate,
          taxPercent: 0,
          amount: subtotal
        });

        currentIn = validOut;
      }

      // Final active room leg
      const lastTransfer = transfers[transfers.length - 1];
      const activeRoom = activeAdmission.roomNumber || lastTransfer.toRoom;
      const tariff = getRoomDailyRate(activeRoom);
      const totalHours = Math.max(1, Math.round((now.getTime() - currentIn.getTime()) / 3600000));
      const wholeDays = Math.floor(totalHours / 24);
      const remHours = totalHours % 24;

      const durationText = wholeDays > 0
        ? (remHours > 0 ? `${wholeDays} Days, ${remHours} Hours` : `${wholeDays} Days`)
        : `${remHours} Hours`;

      const billedDays = Math.max(1, Math.round(totalHours / 24));
      const subtotal = billedDays * tariff.rate;

      stayItems.push({
        id: `STAY-${transfers.length + 1}`,
        type: 'Stay',
        name: `${activeRoom} Accommodation (Current Ward)`,
        provider: 'Inpatient Nursing Service',
        qty: billedDays,
        qtyDisplay: durationText,
        rate: tariff.rate,
        taxPercent: 0,
        amount: subtotal
      });
    }

    return stayItems;
  }, [activeAdmission, activeTransferLogs]);

  // ===============================================================
  // 2. AGGREGATED DRAFT INVOICE (ROOM STAYS DIRECTLY INJECTED)
  // ===============================================================
  const invoiceItems = useMemo(() => {
    const list = [...calculatedRoomStayItems];

    clinicalCharges.forEach(item => {
      const lineSubtotal = item.rate * item.qty;
      const lineTax = lineSubtotal * ((item.taxPercent || 0) / 100);
      list.push({
        ...item,
        amount: lineSubtotal + lineTax
      });
    });

    return list;
  }, [calculatedRoomStayItems, clinicalCharges]);

  // ===============================================================
  // 5. ACCURATE FINANCIAL & TAX CALCULATION ENGINE (STRICT RULES)
  // ===============================================================
  const financialMetrics = useMemo(() => {
    // 1. Calculate Gross Charges & Item Tax (no discount logic)
    const grossCharges = invoiceItems.reduce((acc, item) => acc + (item.rate * item.qty), 0);
    const totalTax = invoiceItems.reduce((acc, item) => {
      const lineSubtotal = item.rate * item.qty;
      return acc + (lineSubtotal * ((item.taxPercent || 0) / 100));
    }, 0);

    // 2. Total Payable (Gross + Tax)
    const totalPayable = grossCharges + totalTax;

    // 3. Deductions (Advance + Net Insurance Approved + Ledger Payments)
    // Insurance Net = Approved Amount - Co-pay
    const netInsuranceApproved = Math.max(0, (tpaState.approvedAmount || 0) - (tpaState.copayAmount || 0));
    const paymentsReceived = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalDeductions = (Number(advanceDeposit) || 0) + netInsuranceApproved + paymentsReceived;

    // 4. Net Outstanding Balance
    const netPayableBalance = Math.round((totalPayable - totalDeductions) * 100) / 100;

    return {
      grossCharges,
      totalTax,
      totalPayable,
      advanceDeposit: Number(advanceDeposit) || 0,
      netInsuranceApproved,
      paymentsReceived,
      totalDeductions,
      netPayableBalance
    };
  }, [invoiceItems, tpaState.approvedAmount, tpaState.copayAmount, advanceDeposit, payments]);

  // ===============================================================
  // 4. CALLBACK ACTIONS & PERFORMANCE OPTIMIZATION
  // ===============================================================

  // Handle payment processing from memoized form
  const handleProcessPayment = useCallback(({ payer, amount, mode }) => {
    const newTxId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
    const dateFormatted = formatLedgerDate(new Date());

    const newTxn = {
      txId: newTxId,
      date: dateFormatted,
      method: mode,
      payer,
      amount,
      status: 'Paid'
    };

    setPayments(prev => [newTxn, ...prev]);
    alert(`Payment Processed Successfully!\nTxn ID: ${newTxId}\nPayer: ${payer}\nAmount: ₹${amount.toFixed(2)} (${mode})`);
  }, []);

  // Print Draft Invoice handler (Working trigger)
  const handlePrintDraft = useCallback(() => {
    setShowPrintModal(true);
  }, []);

  // Generate Final Bill handler
  const handleGenerateFinal = useCallback(() => {
    setFinalBillGenerated(true);
    setFinalInvoiceNumber(`INV-2026-FINAL-${Math.floor(1000 + Math.random() * 9000)}`);
    alert('Official Final Hospital Bill Generated & Locked for Discharge!');
  }, []);

  // Record Co-pay quick action
  const handleQuickCopay = useCallback(() => {
    const copayVal = tpaState.copayAmount > 0 ? tpaState.copayAmount : 5000;
    const amountInput = document.getElementById('payAmountInput');
    if (amountInput) {
      amountInput.value = copayVal.toString();
      amountInput.focus();
    }
  }, [tpaState.copayAmount]);

  // Initiate Discharge handler
  const handleInitiateDischarge = useCallback(() => {
    if (financialMetrics.netPayableBalance > 0) {
      alert(`DISCHARGE BLOCKED: Outstanding balance of ₹${financialMetrics.netPayableBalance.toFixed(2)} remains unpaid.\nPlease clear pending balance before issuing No Dues Clearance.`);
      return;
    }
    if (!finalBillGenerated) {
      handleGenerateFinal();
    }
    alert('DISCHARGE FINANCIAL CLEARANCE GRANTED!\nNo Dues certificate issued. Patient is approved for clinical checkout.');
  }, [financialMetrics.netPayableBalance, finalBillGenerated, handleGenerateFinal]);

  // Send to TPA handler
  const handleSendToTpa = useCallback(() => {
    setTpaState(prev => ({ ...prev, pipelineStage: 'Approval Pending' }));
    alert(`Claim Dossier Dispatched to ${tpaState.insurerName}!\nPolicy ID: ${tpaState.policyId}\nRequested Pre-Auth: ₹${tpaState.preAuthAmount.toFixed(2)}`);
  }, [tpaState.insurerName, tpaState.policyId, tpaState.preAuthAmount]);

  // Visual Pipeline Stages
  const pipelineStages = ['Claim Submitted', 'Approval Pending', 'Co-pay Pending', 'Finalized'];
  const currentStageIndex = pipelineStages.indexOf(tpaState.pipelineStage);

  return (
    <div className="billing-module-container">
      {/* Module Title Header */}
      <div className="billing-header">
        <div className="billing-header-title">
          <i className="fa-solid fa-file-invoice-dollar"></i>
          <span>Module 6: Billing &amp; Insurance Desk</span>
        </div>
        <div className="billing-header-badge">
          Real-world Hospital Administration Standards
        </div>
      </div>

      {/* 3-Column Balanced Layout */}
      <div className="billing-grid-3col">

        {/* ========================================================= */}
        {/* LEFT COLUMN: Patient Context & Cashless Insurance TPA     */}
        {/* ========================================================= */}
        <div className="billing-col">
          {/* Patient / Admission Selector */}
          <div className="billing-card">
            <div className="billing-card-header">
              <span className="billing-card-title">
                <i className="fa-solid fa-user-injured"></i> Patient / IPD Context
              </span>
              <span className="badge-stay">Active Admission</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="patientSelect">Select Inpatient</label>
              <select
                id="patientSelect"
                className="form-control"
                value={selectedAdmissionId}
                onChange={(e) => setSelectedAdmissionId(e.target.value)}
              >
                {admissions.map(adm => (
                  <option key={adm.admissionId} value={adm.admissionId}>
                    {adm.fullName} (UHID: {adm.patientId} • {adm.roomNumber})
                  </option>
                ))}
              </select>
            </div>

            {activeAdmission && (
              <div className="patient-chip">
                <div><strong>Patient:</strong> {activeAdmission.fullName} ({activeAdmission.ageGender})</div>
                <div><strong>UHID:</strong> {activeAdmission.patientId} | <strong>Adm ID:</strong> {activeAdmission.admissionId}</div>
                <div><strong>Location:</strong> {activeAdmission.department} • <strong>{activeAdmission.roomNumber}</strong></div>
                <div><strong>Primary Doctor:</strong> {activeAdmission.attendingDoctor}</div>
                <div><strong>Caregiver:</strong> {activeAdmission.caregiverName} ({activeAdmission.caregiverPhone})</div>
              </div>
            )}
          </div>

          {/* Cashless Insurance & TPA Claim Pipeline */}
          <div className="billing-card">
            <div className="billing-card-header">
              <span className="billing-card-title">
                <i className="fa-solid fa-shield-halved"></i> Cashless Insurance &amp; TPA
              </span>
              <span className="badge-lab">{tpaState.pipelineStage}</span>
            </div>

            {/* Visual Pipeline Status Bar */}
            <div className="tpa-pipeline">
              {pipelineStages.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isActive = idx === currentStageIndex;
                return (
                  <button
                    key={stage}
                    type="button"
                    className={`tpa-pipeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                    onClick={() => setTpaState(prev => ({ ...prev, pipelineStage: stage }))}
                    title={stage}
                  >
                    <div className="tpa-step-icon">
                      {isCompleted ? <i className="fa-solid fa-check"></i> : idx + 1}
                    </div>
                    <div className="tpa-step-label">{stage}</div>
                  </button>
                );
              })}
            </div>

            {/* TPA Fields */}
            <div className="form-group">
              <label className="form-label" htmlFor="tpaName">TPA / Insurer Name</label>
              <select
                id="tpaName"
                className="form-control"
                value={tpaState.insurerName}
                onChange={(e) => setTpaState(prev => ({ ...prev, insurerName: e.target.value }))}
              >
                <option value="Star Health and Allied Insurance">Star Health and Allied Insurance</option>
                <option value="HDFC ERGO General Insurance">HDFC ERGO General Insurance</option>
                <option value="ICICI Lombard Health Care">ICICI Lombard Health Care</option>
                <option value="Medi Assist Insurance TPA">Medi Assist Insurance TPA</option>
                <option value="Paramount Health Services TPA">Paramount Health Services TPA</option>
                <option value="Vidal Health Insurance TPA">Vidal Health Insurance TPA</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="policyId">Policy ID</label>
                <input
                  id="policyId"
                  type="text"
                  className="form-control"
                  value={tpaState.policyId}
                  onChange={(e) => setTpaState(prev => ({ ...prev, policyId: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="authId">Claim / Pre-Auth ID</label>
                <input
                  id="authId"
                  type="text"
                  className="form-control"
                  value={tpaState.authId}
                  onChange={(e) => setTpaState(prev => ({ ...prev, authId: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="preAuthAmt">Pre-Auth (₹)</label>
                <input
                  id="preAuthAmt"
                  type="number"
                  className="form-control"
                  value={tpaState.preAuthAmount}
                  onChange={(e) => setTpaState(prev => ({ ...prev, preAuthAmount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="approvedAmt">Approved (₹)</label>
                <input
                  id="approvedAmt"
                  type="number"
                  className="form-control"
                  value={tpaState.approvedAmount}
                  onChange={(e) => setTpaState(prev => ({ ...prev, approvedAmount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="copayAmt">Co-pay (₹)</label>
                <input
                  id="copayAmt"
                  type="number"
                  className="form-control"
                  value={tpaState.copayAmount}
                  onChange={(e) => setTpaState(prev => ({ ...prev, copayAmount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 10px', fontSize: '11.5px', marginBottom: '8px', color: '#166534' }}>
              <strong>Net Insurance Approved:</strong> ₹{financialMetrics.netInsuranceApproved.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              <div style={{ fontSize: '10.5px', color: '#15803d' }}>(Approved ₹{tpaState.approvedAmount.toLocaleString('en-IN')} - Co-pay ₹{tpaState.copayAmount.toLocaleString('en-IN')})</div>
            </div>

            <button
              type="button"
              className="quick-action-btn btn-final"
              onClick={() => alert(`Insurance Status Updated to: ${tpaState.pipelineStage}\nNet Approved Coverage: ₹${financialMetrics.netInsuranceApproved.toLocaleString('en-IN')}`)}
            >
              <i className="fa-solid fa-arrows-rotate"></i> Update Claim Status
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CENTER COLUMN: Aggregated Draft Invoice & Payment Ledger */}
        {/* ========================================================= */}
        <div className="billing-col">
          {/* 1. Aggregated Draft Invoice Table (Read-only, Room charges injected directly) */}
          <div className="billing-card">
            <div className="billing-card-header">
              <span className="billing-card-title">
                <i className="fa-solid fa-list-check"></i> Aggregated Draft Invoice
              </span>
              <span className="badge-stay">Read-Only Audit Trail</span>
            </div>

            <div className="draft-table-wrapper">
              <table className="draft-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Item Name</th>
                    <th>Doctor / Provider</th>
                    <th style={{ textAlign: 'center' }}>Qty / Duration</th>
                    <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ textAlign: 'center' }}>Tax %</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                        No items in draft invoice.
                      </td>
                    </tr>
                  ) : (
                    invoiceItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          <span className={`type-badge badge-${item.type.toLowerCase()}`}>
                            {item.type}
                          </span>
                        </td>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td style={{ color: '#475569' }}>{item.provider}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.qtyDisplay || `${item.qty} Unit`}</td>
                        <td style={{ textAlign: 'right' }}>₹{Number(item.rate).toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'center' }}>{item.taxPercent || 0}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                          ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Subtotal Summary Fields (Gross, Tax, Total Payable) */}
            <div className="draft-subtotals">
              <div className="draft-subtotal-item">
                <span className="sub-label">Total Gross Charges</span>
                <span className="sub-amount">₹{financialMetrics.grossCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="draft-subtotal-item">
                <span className="sub-label">Total Tax</span>
                <span className="sub-amount" style={{ color: '#0284c7' }}>+₹{financialMetrics.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="draft-subtotal-item">
                <span className="sub-label">Total Payable</span>
                <span className="sub-amount payable">₹{financialMetrics.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* 3. Payment & Reconciliation Ledger & Simplified Counter Payment */}
          <div className="billing-card">
            <div className="billing-card-header">
              <span className="billing-card-title">
                <i className="fa-solid fa-receipt"></i> Payment &amp; Reconciliation Ledger
              </span>
              <span className="badge-pharmacy">Live Audit Log</span>
            </div>

            <div className="draft-table-wrapper">
              <table className="draft-table">
                <thead>
                  <tr>
                    <th>Txn ID</th>
                    <th>Date &amp; Time</th>
                    <th>Payment Mode</th>
                    <th>Payer / Caregiver</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No payments recorded.</td>
                    </tr>
                  ) : (
                    payments.map(p => (
                      <tr key={p.txId}>
                        <td><code>{p.txId}</code></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatLedgerDate(p.date)}</td>
                        <td><strong>{p.method}</strong></td>
                        <td style={{ fontSize: '12px' }}>{p.payer}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}><span className="badge-pharmacy">{p.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Simplified Collect Counter Payment Form */}
            <CounterPaymentForm
              onProcessPayment={handleProcessPayment}
              defaultPayer={activeAdmission ? `${activeAdmission.caregiverName} (Caregiver)` : ''}
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Overall Bill Summary & Quick Actions Desk   */}
        {/* ========================================================= */}
        <div className="billing-col sticky-summary">
          {/* Overall Bill Summary Card */}
          <div className="billing-card">
            <div className="billing-card-header">
              <span className="billing-card-title">
                <i className="fa-solid fa-scale-balanced"></i> Overall Bill Summary
              </span>
              <span className={finalBillGenerated ? 'badge-pharmacy' : 'badge-service'}>
                {finalBillGenerated ? 'Final Bill Locked' : 'Draft In Progress'}
              </span>
            </div>

            <div className="summary-metric">
              <span className="metric-lbl"><i className="fa-solid fa-list-ol"></i> Gross Charges</span>
              <span className="metric-val">₹{financialMetrics.grossCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="summary-metric">
              <span className="metric-lbl"><i className="fa-solid fa-percent"></i> Total Tax (GST)</span>
              <span className="metric-val" style={{ color: '#0284c7' }}>+₹{financialMetrics.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="summary-metric" style={{ background: '#f8fafc', padding: '8px', borderRadius: '4px' }}>
              <span className="metric-lbl" style={{ fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-calculator"></i> Total Payable
              </span>
              <span className="metric-val" style={{ fontSize: '15px' }}>
                ₹{financialMetrics.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="summary-metric deduction">
              <span className="metric-lbl">
                <i className="fa-solid fa-wallet"></i> Advanced Deposit Paid
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', marginLeft: '6px' }}
                  onClick={() => {
                    const promptVal = prompt('Adjust Advance Deposit (₹):', advanceDeposit);
                    if (promptVal !== null) setAdvanceDeposit(parseFloat(promptVal) || 0);
                  }}
                >
                  Adjust
                </button>
              </span>
              <span className="metric-val">-₹{financialMetrics.advanceDeposit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="summary-metric deduction">
              <span className="metric-lbl">
                <i className="fa-solid fa-shield-check"></i> Net Insurance Approved
              </span>
              <span className="metric-val">-₹{financialMetrics.netInsuranceApproved.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="summary-metric deduction">
              <span className="metric-lbl"><i className="fa-solid fa-money-check-dollar"></i> Payments Received</span>
              <span className="metric-val">-₹{financialMetrics.paymentsReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            {/* Prominently Highlighted Net Outstanding Balance */}
            <div className={`net-balance-banner ${financialMetrics.netPayableBalance <= 0 ? 'clear' : 'due'}`}>
              <div className="net-banner-title">Net Outstanding Balance</div>
              <div className="net-banner-val">
                {financialMetrics.netPayableBalance <= 0
                  ? '₹0.00'
                  : `₹${financialMetrics.netPayableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </div>
              <div>
                {financialMetrics.netPayableBalance <= 0 ? (
                  <span className="badge-pharmacy"><i className="fa-solid fa-circle-check"></i> Clear / No Dues</span>
                ) : (
                  <span className="badge-stay" style={{ background: '#fee2e2', color: '#b91c1c' }}><i className="fa-solid fa-clock"></i> Payment Due</span>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Discharge Checklist */}
          <div className="billing-card">
            <div className="billing-card-header">
              <span className="billing-card-title">
                <i className="fa-solid fa-list-check"></i> Discharge Clearance Checklist
              </span>
            </div>

            <div>
              <div className={`checklist-item ${invoiceItems.length > 0 ? 'passed' : 'failed'}`}>
                <div className="checklist-dot">{invoiceItems.length > 0 ? '✓' : '✗'}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>All Charges Added</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{invoiceItems.length} items</span>
              </div>

              <div className={`checklist-item ${financialMetrics.advanceDeposit >= 0 ? 'passed' : 'failed'}`}>
                <div className="checklist-dot">{financialMetrics.advanceDeposit >= 0 ? '✓' : '✗'}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>Advance Deposits Adjusted</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Applied</span>
              </div>

              <div className={`checklist-item ${finalBillGenerated ? 'passed' : 'failed'}`}>
                <div className="checklist-dot">{finalBillGenerated ? '✓' : '✗'}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>Final Bill Generated</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{finalBillGenerated ? 'Generated' : 'Draft'}</span>
              </div>

              <div className={`checklist-item ${tpaState.pipelineStage === 'Finalized' || tpaState.pipelineStage === 'Approved' ? 'passed' : 'failed'}`}>
                <div className="checklist-dot">{tpaState.pipelineStage === 'Finalized' || tpaState.pipelineStage === 'Approved' ? '✓' : '✗'}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>Insurance Final Settlement</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{tpaState.pipelineStage}</span>
              </div>

              <div className={`checklist-item ${financialMetrics.netPayableBalance <= 0 ? 'passed' : 'failed'}`}>
                <div className="checklist-dot">{financialMetrics.netPayableBalance <= 0 ? '✓' : '✗'}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>Patient No Dues Clearance</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{financialMetrics.netPayableBalance <= 0 ? 'Verified' : 'Pending'}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="billing-card">
            <div className="billing-card-header">
              <span className="billing-card-title">
                <i className="fa-solid fa-bolt"></i> Quick Financial Actions
              </span>
            </div>

            <button type="button" className="quick-action-btn btn-print" onClick={handlePrintDraft}>
              <i className="fa-solid fa-print"></i> Print Draft Invoice
            </button>
            <button type="button" className="quick-action-btn btn-final" onClick={handleGenerateFinal}>
              <i className="fa-solid fa-file-shield"></i> Generate Final Bill
            </button>
            <button type="button" className="quick-action-btn btn-pay" onClick={handleQuickCopay}>
              <i className="fa-solid fa-coins"></i> Record Co-pay / New Payment
            </button>
            <button type="button" className="quick-action-btn btn-discharge" onClick={handleInitiateDischarge}>
              <i className="fa-solid fa-door-open"></i> Initiate Discharge
            </button>
            <button type="button" className="quick-action-btn btn-tpa" onClick={handleSendToTpa}>
              <i className="fa-solid fa-paper-plane"></i> Send to TPA
            </button>
          </div>
        </div>

      </div>

      {/* =============================================================== */}
      {/* PRINT DRAFT INVOICE MODAL                                       */}
      {/* =============================================================== */}
      {showPrintModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0284c7', paddingBottom: '16px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a' }}>ST. JUDE MULTISPECIALTY HOSPITAL</h2>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Tertiary Healthcare Centre • 104 Healthcare Boulevard</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={finalBillGenerated ? 'badge-pharmacy' : 'badge-service'}>
                  {finalBillGenerated ? 'FINAL TAX INVOICE' : 'DRAFT ESTIMATED INVOICE'}
                </span>
                <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>
                  Invoice #: <code>{finalBillGenerated ? finalInvoiceNumber : `INV-${activeAdmission?.admissionId}-DRAFT`}</code>
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <div><strong>Patient Name:</strong> {activeAdmission?.fullName} ({activeAdmission?.ageGender})</div>
              <div><strong>UHID:</strong> {activeAdmission?.patientId} | <strong>Admission ID:</strong> {activeAdmission?.admissionId}</div>
              <div><strong>Location:</strong> {activeAdmission?.roomNumber} • <strong>Attending:</strong> {activeAdmission?.attendingDoctor}</div>
              <div><strong>TPA / Insurer:</strong> {tpaState.insurerName} ({tpaState.policyId})</div>
            </div>

            <table className="draft-table" style={{ marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Provider</th>
                  <th style={{ textAlign: 'center' }}>Qty / Duration</th>
                  <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ textAlign: 'center' }}>Tax %</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.provider}</td>
                    <td style={{ textAlign: 'center' }}>{item.qtyDisplay || `${item.qty} Unit`}</td>
                    <td style={{ textAlign: 'right' }}>₹{item.rate.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'center' }}>{item.taxPercent || 0}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ width: '320px', fontSize: '12.5px', lineHeight: '1.8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gross Charges:</span> <strong>₹{financialMetrics.grossCharges.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0284c7' }}><span>Total Tax:</span> <strong>+₹{financialMetrics.totalTax.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e2e8f0' }}><span>Total Payable:</span> <strong>₹{financialMetrics.totalPayable.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}><span>Advance Adjusted:</span> <strong>-₹{financialMetrics.advanceDeposit.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}><span>Net Insurance Approved:</span> <strong>-₹{financialMetrics.netInsuranceApproved.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}><span>Payments Received:</span> <strong>-₹{financialMetrics.paymentsReceived.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', borderTop: '2px solid #0f172a', paddingTop: '4px' }}>
                  <span>NET OUTSTANDING:</span>
                  <span>{financialMetrics.netPayableBalance <= 0 ? '₹0.00 (NO DUES)' : `₹${financialMetrics.netPayableBalance.toFixed(2)}`}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-pay" style={{ padding: '8px 16px', borderRadius: '6px' }} onClick={() => setShowPrintModal(false)}>
                Close
              </button>
              <button type="button" className="quick-action-btn btn-final" style={{ width: 'auto', padding: '8px 20px', margin: 0 }} onClick={() => window.print()}>
                <i className="fa-solid fa-print"></i> Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

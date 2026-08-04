export const generateOfferLetterHtml = (offer) => {
  const template = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Offer of Employment - ${offer.offerNumber}</title>
        <style>
          body { font-family: 'Outfit', sans-serif; padding: 40px; color: #333; }
          h1 { color: #1e3a8a; }
          ul { line-height: 1.6; }
        </style>
      </head>
      <body>
        <h1>OFFER OF EMPLOYMENT</h1>
        <p>Dear ${offer.candidateSnapshot.fullName},</p>
        <p>We are pleased to offer you the position of <strong>${offer.title}</strong> at <strong>${offer.jobSnapshot.companyName}</strong>.</p>
        <p>Here are the details of your offer:</p>
        <ul>
          <li><strong>Base Salary:</strong> ${offer.compensation.currency} ${offer.compensation.base} per ${offer.compensation.period}</li>
          <li><strong>Joining Date:</strong> ${offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString() : 'TBD'}</li>
          <li><strong>Employment Type:</strong> ${offer.employmentType}</li>
          <li><strong>Work Mode:</strong> ${offer.workMode}</li>
          <li><strong>Benefits:</strong> ${offer.benefits?.join(', ') || 'Standard company benefits'}</li>
        </ul>
        <p>Please review and sign this offer letter before ${offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString() : 'the expiration date'}.</p>
      </body>
    </html>
  `;
  return template.trim();
};

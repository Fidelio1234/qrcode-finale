// backend/licenses.js
const LICENSES = {
  TRIAL: {
    type: 'TRIAL',
    name: 'Licenza Trial',
    duration: 15, // giorni
    price: 0,
    features: ['full_access', 'basic_support'],
    message: 'Licenza di prova - 15 giorni'
  },
  SEMESTRAL: {
    type: 'SEMESTRAL', 
    name: 'Licenza Semestrale',
    duration: 180, // giorni (6 mesi)
    price: 299,
    features: ['full_access', 'priority_support', 'updates', 'backup'],
    message: 'Licenza semestrale - 6 mesi'
  },
  ANNUAL: {
    type: 'ANNUAL',
    name: 'Licenza Annuale', 
    duration: 365, // giorni (1 anno)
    price: 499,
    features: ['full_access', 'priority_support', 'all_updates', 'backup', 'phone_support'],
    message: 'Licenza annuale - 12 mesi'
  }
};

// ✅ Genera una licenza trial automatica
function generateTrialLicense() {
  const issueDate = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(issueDate.getDate() + LICENSES.TRIAL.duration);
  
  return {
    type: 'TRIAL',
    issueDate: issueDate.toISOString(),
    expiryDate: expiryDate.toISOString(),
    licenseId: 'TRIAL_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    customer: {
      name: 'Trial User',
      email: 'trial@ristorante.com'
    },
    activated: new Date().toISOString(),
    machineId: require('os').hostname()
  };
}

// ✅ Genera chiavi di licenza per i clienti
function generateLicenseKey(licenseType) {
  const prefix = licenseType.toUpperCase().substr(0, 4);
  const random = Math.random().toString(36).substr(2, 12).toUpperCase();
  return `${prefix}-${random}-${Date.now().toString(36).toUpperCase()}`;
}

module.exports = { 
  LICENSES, 
  generateTrialLicense, 
  generateLicenseKey 
};
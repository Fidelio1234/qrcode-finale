// license-routes.js
/*const express = require('express');
const LicenseManager = require('./license-manager');
const { LICENSES } = require('./licenses');

const router = express.Router();
const licenseManager = new LicenseManager();

// ✅ ROUTE PER STATO LICENZA
router.get('/status', (req, res) => {
  try {
    const status = licenseManager.verifyLicense();
    
    res.json({
      success: true,
      license: status,
      system: {
        serverTime: new Date().toISOString(),
        machineId: require('os').hostname()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ROUTE PER ATTIVAZIONE LICENZA A PAGAMENTO
router.post('/activate', (req, res) => {
  try {
    const { licenseType, customerInfo } = req.body;
    
    console.log('🎯 Richiesta attivazione licenza:', { licenseType, customerInfo });
    
    if (!licenseType || !customerInfo) {
      return res.status(400).json({
        success: false,
        error: 'Tipo licenza e informazioni cliente sono obbligatorie'
      });
    }

    if (!['SEMESTRAL', 'ANNUAL'].includes(licenseType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo licenza non valido. Usare: SEMESTRAL o ANNUAL'
      });
    }

    if (!customerInfo.name || !customerInfo.email) {
      return res.status(400).json({
        success: false,
        error: 'Nome e email del cliente sono obbligatori'
      });
    }

    // Genera la licenza a pagamento
    const licenseData = licenseManager.generatePaidLicense(licenseType, customerInfo);
    
    // Salva la licenza
    licenseManager.saveLicense(licenseData);
    
    console.log('✅ Licenza attivata:', licenseData.licenseId);
    
    res.json({
      success: true,
      message: `Licenza ${licenseType.toLowerCase()} attivata con successo!`,
      license: licenseData,
      expiryDate: licenseData.expiryDate,
      daysRemaining: licenseManager.verifyLicense().daysRemaining
    });

  } catch (error) {
    console.error('❌ Errore attivazione licenza:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'attivazione della licenza: ' + error.message
    });
  }
});

// ✅ ROUTE PER ATTIVAZIONE TRIAL
router.post('/trial', (req, res) => {
  try {
    const customerInfo = req.body || {};
    const trialLicense = licenseManager.createTrialLicense(customerInfo);
    
    res.json({
      success: true,
      message: 'Licenza trial attivata!',
      license: trialLicense,
      expiryDate: trialLicense.expiryDate,
      daysRemaining: licenseManager.verifyLicense().daysRemaining
    });
  } catch (error) {
    console.error('❌ Errore attivazione trial:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ROUTE PER RESET LICENZA (solo sviluppo)
router.post('/reset', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Reset licenza non permesso in produzione'
      });
    }
    
    const result = licenseManager.resetLicense();
    
    res.json({
      success: true,
      message: 'Licenza resettata',
      license: result
    });
  } catch (error) {
    console.error('❌ Errore reset licenza:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ROUTE PER INFO LICENZE DISPONIBILI
router.get('/types', (req, res) => {
  res.json({
    success: true,
    licenses: LICENSES
  });
});

// ✅ ROUTE DI DEBUG (solo sviluppo)
router.get('/debug', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const licenseFile = path.join(__dirname, 'license.json');
    
    let fileContent = null;
    if (fs.existsSync(licenseFile)) {
      fileContent = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
    }
    
    const status = licenseManager.verifyLicense();
    
    res.json({
      fileExists: fs.existsSync(licenseFile),
      fileContent: fileContent,
      verification: status,
      serverTime: new Date().toISOString(),
      machineId: require('os').hostname()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;

*/

router.get('/status', (req, res) => {
  try {
    const status = licenseManager.verifyLicense();
    
    console.log('📊 API License Status Response:', {
      valid: status.valid,
      daysRemaining: status.daysRemaining,
      type: status.type,
      expiryDate: status.expiryDate
    });
    
    // ✅ STRUTTURA CORRETTA CHE IL FRONTEND SI ASPETTA
    res.json({
      success: true,
      license: {
        valid: status.valid,
        license: status.license,        // ✅ L'OGGETTO LICENZA COMPLETO
        daysRemaining: status.daysRemaining, // ✅ GIORNI CALCOLATI CORRETTAMENTE
        type: status.type,
        expiryDate: status.expiryDate,
        trial: status.trial,
        paid: status.paid
      },
      system: {
        serverTime: new Date().toISOString(),
        machineId: require('os').hostname()
      }
    });
  } catch (error) {
    console.error('❌ Errore /api/license/status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});




// ✅ ENDPOINT DEBUG PER VERIFICARE IL CALCOLO
router.get('/debug-calcolo', (req, res) => {
  try {
    const status = licenseManager.verifyLicense();
    const licenseInfo = licenseManager.getLicenseInfo();
    
    const oggi = new Date();
    const scadenza = new Date(licenseInfo.expiryDate);
    
    // Calcolo VECCHIO (sbagliato)
    const giorniVecchio = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
    
    // Calcolo NUOVO (corretto)
    const oggiMezzanotte = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    const scadenzaMezzanotte = new Date(scadenza.getFullYear(), scadenza.getMonth(), scadenza.getDate());
    const giorniNuovo = Math.ceil((scadenzaMezzanotte - oggiMezzanotte) / (1000 * 60 * 60 * 24));
    
    res.json({
      calcoli: {
        backend: giorniNuovo,
        frontend: status.daysRemaining,
        vecchioCalcolo: giorniVecchio
      },
      date: {
        oggi: oggi.toISOString(),
        oggiMezzanotte: oggiMezzanotte.toISOString(),
        scadenza: scadenza.toISOString(),
        scadenzaMezzanotte: scadenzaMezzanotte.toISOString()
      },
      differenza: {
        giorni: giorniNuovo - giorniVecchio,
        ore: (scadenzaMezzanotte - oggiMezzanotte) / (1000 * 60 * 60)
      },
      statusCompleto: status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ ROUTE PER ATTIVAZIONE LICENZA A PAGAMENTO
router.post('/activate', (req, res) => {
  try {
    const { licenseType, customerInfo } = req.body;
    
    console.log('🎯 Richiesta attivazione licenza:', { licenseType, customerInfo });
    
    if (!licenseType || !customerInfo) {
      return res.status(400).json({
        success: false,
        error: 'Tipo licenza e informazioni cliente sono obbligatorie'
      });
    }

    if (!['SEMESTRAL', 'ANNUAL'].includes(licenseType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo licenza non valido. Usare: SEMESTRAL o ANNUAL'
      });
    }

    if (!customerInfo.name || !customerInfo.email) {
      return res.status(400).json({
        success: false,
        error: 'Nome e email del cliente sono obbligatori'
      });
    }

    // Genera la licenza a pagamento
    const licenseData = licenseManager.generatePaidLicense(licenseType, customerInfo);
    
    // Salva la licenza
    licenseManager.saveLicense(licenseData);
    
    console.log('✅ Licenza attivata:', licenseData.licenseId);
    
    res.json({
      success: true,
      message: `Licenza ${licenseType.toLowerCase()} attivata con successo!`,
      license: licenseData,
      expiryDate: licenseData.expiryDate,
      daysRemaining: licenseManager.verifyLicense().daysRemaining
    });

  } catch (error) {
    console.error('❌ Errore attivazione licenza:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'attivazione della licenza: ' + error.message
    });
  }
});

// ✅ ROUTE PER ATTIVAZIONE TRIAL
router.post('/trial', (req, res) => {
  try {
    const customerInfo = req.body || {};
    const trialLicense = licenseManager.createTrialLicense(customerInfo);
    
    res.json({
      success: true,
      message: 'Licenza trial attivata!',
      license: trialLicense,
      expiryDate: trialLicense.expiryDate,
      daysRemaining: licenseManager.verifyLicense().daysRemaining
    });
  } catch (error) {
    console.error('❌ Errore attivazione trial:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ROUTE PER RESET LICENZA (solo sviluppo)
router.post('/reset', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Reset licenza non permesso in produzione'
      });
    }
    
    const result = licenseManager.resetLicense();
    
    res.json({
      success: true,
      message: 'Licenza resettata',
      license: result
    });
  } catch (error) {
    console.error('❌ Errore reset licenza:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ROUTE PER INFO LICENZE DISPONIBILI
router.get('/types', (req, res) => {
  res.json({
    success: true,
    licenses: LICENSES
  });
});

// ✅ ROUTE DI DEBUG (solo sviluppo)
router.get('/debug', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const licenseFile = path.join(__dirname, 'license.json');
    
    let fileContent = null;
    if (fs.existsSync(licenseFile)) {
      fileContent = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
    }
    
    const status = licenseManager.verifyLicense();
    
    res.json({
      fileExists: fs.existsSync(licenseFile),
      fileContent: fileContent,
      verification: status,
      serverTime: new Date().toISOString(),
      machineId: require('os').hostname()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
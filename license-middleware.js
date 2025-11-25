// backend/license-middleware.js
/*const LicenseManager = require('./license-manager');
const licenseManager = new LicenseManager();

function licenseCheck(req, res, next) {
  // ✅ Route pubbliche che funzionano SEMPRE
  const publicRoutes = [
    '/api/health',
    '/api/license/status',
    '/api/license/activate',
    '/api/license/info',
    '/api/license/trial',
    '/api/license/debug',
    '/api/license/reset'
  ];

  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // ✅ Verifica licenza
  const licenseStatus = licenseManager.verifyLicense();
  
  if (!licenseStatus.valid) {
    console.log(`🚫 Accesso bloccato - ${req.path} - Motivo: ${licenseStatus.reason}`);
    
    return res.status(403).json({
      error: 'LICENSE_REQUIRED',
      message: 'Licenza non valida',
      reason: licenseStatus.reason,
      action: 'activate_license',
      details: licenseStatus
    });
  }

  // ✅ Licenza valida
  req.license = licenseStatus.license;
  req.licenseStatus = licenseStatus;
  
  next();
}

function licenseInfo(req, res, next) {
  const licenseStatus = licenseManager.verifyLicense();
  req.licenseStatus = licenseStatus;
  next();
}

// ✅ Route di debug per il sistema licenze
function setupLicenseDebugRoutes(app) {
  app.get('/api/license/debug', (req, res) => {
    const status = licenseManager.verifyLicense();
    res.json({
      system: 'License Debug',
      timestamp: new Date().toISOString(),
      status: status
    });
  });

  app.post('/api/license/reset', (req, res) => {
    try {
      const result = licenseManager.resetLicense();
      res.json({
        success: true,
        message: 'Licenza resettata',
        newLicense: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = { 
  licenseCheck, 
  licenseInfo, 
  setupLicenseDebugRoutes 
};

*/



// backend/license-middleware.js
const LicenseManager = require('./license-manager');
const licenseManager = new LicenseManager();

function licenseCheck(req, res, next) {
  // ✅ Route pubbliche che funzionano SEMPRE (anche con licenza scaduta)
  const publicRoutes = [
    '/api/health',
    '/api/license/status',
    '/api/license/activate',
    '/api/license/info',
    '/api/license/trial',
    '/api/license/debug',
    '/api/license/reset',
    '/api/license/dettagli'
  ];

  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // ✅ Verifica licenza CON CONTROLLO STRETTO
  const licenseStatus = licenseManager.verifyLicense();
  
  console.log('🔍 License Check - Path:', req.path, {
    valid: licenseStatus.valid,
    daysRemaining: licenseStatus.daysRemaining,
    reason: licenseStatus.reason
  });
  
  // ❌ BLOCCA TUTTO SE LICENZA NON VALIDA O SCADUTA
  if (!licenseStatus.valid || licenseStatus.daysRemaining <= 0) {
    console.log(`🚫 ACCESSO BLOCCATO - ${req.path} - Licenza: ${licenseStatus.reason}`);
    
    return res.status(403).json({
      error: 'LICENSE_EXPIRED',
      message: 'Licenza scaduta o non valida',
      reason: licenseStatus.reason,
      daysRemaining: licenseStatus.daysRemaining || 0,
      action: 'renew_license',
      blockSystem: true,
      details: {
        expired: true,
        requiresPayment: !licenseStatus.trial,
        contactSupport: true
      }
    });
  }

  // ✅ Licenza valida - permetti accesso
  req.license = licenseStatus.license;
  req.licenseStatus = licenseStatus;
  
  next();
}

// ✅ MIDDLEWARE PER BLOCCARE COMPLETAMENTE IL SISTEMA SE SCADUTO
function systemLock(requiredRoutes = []) {
  return (req, res, next) => {
    const licenseStatus = licenseManager.verifyLicense();
    
    // Route che funzionano SEMPRE (anche con licenza scaduta)
    const alwaysAllowed = [
      '/api/health',
      '/api/license/status',
      '/api/license/activate',
      '/api/license/trial',
      '/api/license/debug'
    ];
    
    const currentRoute = req.path;
    
    // Se la route è sempre permessa, passa
    if (alwaysAllowed.includes(currentRoute) || requiredRoutes.includes(currentRoute)) {
      return next();
    }
    
    // ❌ SE LICENZA SCADUTA, BLOCCA TUTTO IL RESTO
    if (!licenseStatus.valid || licenseStatus.daysRemaining <= 0) {
      console.log(`🔒 SISTEMA BLOCCATO - Licenza scaduta - Route: ${currentRoute}`);
      
      return res.status(423).json({ // 423 = Locked
        error: 'SYSTEM_LOCKED',
        message: 'Sistema bloccato - Licenza scaduta',
        code: 'LICENSE_EXPIRED',
        reason: licenseStatus.reason,
        daysRemaining: 0,
        actions: [
          'Contattare il supporto tecnico',
          'Rinnovare la licenza',
          'Riattivare trial se disponibile'
        ],
        contact: {
          email: 'support@ristorantebellavista.com',
          phone: '+39 123 456 7890'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

// ✅ MIDDLEWARE PER PAGINE CRITICHE (blocco totale)
function criticalSystemLock(req, res, next) {
  const licenseStatus = licenseManager.verifyLicense();
  
  // ❌ BLOCCA IMMEDIATAMENTE SE LICENZA SCADUTA
  if (!licenseStatus.valid || licenseStatus.daysRemaining <= 0) {
    console.log(`🔐 ACCESSO CRITICO BLOCCATO - Sistema disattivato`);
    
    return res.status(423).json({
      error: 'CRITICAL_SYSTEM_DISABLED',
      message: 'Sistema disattivato - Licenza scaduta',
      severity: 'CRITICAL',
      systemStatus: 'DISABLED',
      requiredAction: 'license_renewal',
      supportContact: {
        email: 'support@ristorantebellavista.com',
        urgency: 'IMMEDIATE'
      }
    });
  }
  
  next();
}

module.exports = { 
  licenseCheck, 
  systemLock,
  criticalSystemLock,
  //licenseInfo: require('./license-middleware').licenseInfo,
  //setupLicenseDebugRoutes: require('./license-middleware').setupLicenseDebugRoutes
};
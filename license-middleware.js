// backend/license-middleware.js
const LicenseManager = require('./license-manager');
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
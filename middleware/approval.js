// Middleware to check if parent account is approved
const requireApprovedParent = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  // If user is a parent and not approved, redirect to pending approval page
  if (req.session.user.role === 'parent' && !req.session.user.is_approved) {
    return res.redirect('/auth/pending-approval');
  }
  
  next();
};

// Middleware to check if user is authenticated and approved (for all roles)
const requireApprovedUser = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  // If user is a parent and not approved, redirect to pending approval page
  if (req.session.user.role === 'parent' && !req.session.user.is_approved) {
    return res.redirect('/auth/pending-approval');
  }
  
  next();
};

module.exports = {
  requireApprovedParent,
  requireApprovedUser
}; 
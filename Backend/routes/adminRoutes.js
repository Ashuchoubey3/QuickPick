const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/register', [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { firstName, lastName, email, password } = req.body;

    try {
        let admin = await Admin.findOne({ email });
        if (admin) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        admin = new Admin({
            firstName,
            lastName,
            email,
            password,
            role: 'admin'
        });

        await admin.save();
        res.status(201).json({ message: 'Admin registered successfully', admin: { id: admin.id, email: admin.email } });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error during admin registration');
    }
});

router.get('/sellers/pending', protect, authorize('admin'), async (req, res) => {
    try {
        const pendingSellers = await Seller.find({ isApproved: false }).select('-password');
        res.json(pendingSellers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.put('/sellers/:id/approve', protect, authorize('admin'), async (req, res) => {
    try {
        const seller = await Seller.findById(req.params.id);

        if (!seller) {
            return res.status(404).json({ message: 'Seller not found' });
        }

        if (seller.isApproved) {
            return res.status(400).json({ message: 'Seller is already approved' });
        }

        seller.isApproved = true;
        await seller.save();

        res.json({ message: `Seller ${seller.shopName} approved successfully`, seller });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Seller ID' });
        }
        res.status(500).send('Server error');
    }
});

router.put('/sellers/:id/reject', protect, authorize('admin'), async (req, res) => {
    try {
        const seller = await Seller.findById(req.params.id);

        if (!seller) {
            return res.status(404).json({ message: 'Seller not found' });
        }

        if (!seller.isApproved) {
            return res.status(400).json({ message: 'Seller is already not approved' });
        }

        seller.isApproved = false; 
        await seller.save();

        res.json({ message: `Seller ${seller.shopName} rejected/deactivated`, seller });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Seller ID' });
        }
        res.status(500).send('Server error');
    }
});

router.get('/customers', protect, authorize('admin'), async (req, res) => {
    try {
        const customers = await Customer.find().select('-password');
        res.json(customers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.delete('/users/:id', protect, authorize('admin'), async (req, res) => {
    try {
        let user = await Customer.findByIdAndDelete(req.params.id);

        if (!user) {
            user = await Seller.findByIdAndDelete(req.params.id);
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: `User with ID ${req.params.id} (${user.role}) deleted successfully` });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid User ID' });
        }
        res.status(500).send('Server error');
    }
});

router.get('/sellers', protect, authorize('admin'), async (req, res) => {
    try {
        const allSellers = await Seller.find().select('-password');
        res.json(allSellers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error fetching all sellers');
    }
});

router.get('/users/total-count', protect, authorize('admin'), async (req, res) => {
    try {
        const customerCount = await Customer.countDocuments();
        const sellerCount = await Seller.countDocuments();
        const adminCount = await Admin.countDocuments(); 

        const totalUsers = customerCount + sellerCount + adminCount;
        res.json({ totalUsers });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error fetching total user count');
    }
});

router.post('/admin-management/create-admin', protect, authorize('superadmin'), [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('role', 'Invalid role specified').optional().isIn(['admin', 'superadmin'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { firstName, lastName, email, password, role } = req.body;

    try {
        let adminExists = await Admin.findOne({ email });
        if (adminExists) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        const newAdmin = new Admin({
            firstName,
            lastName,
            email,
            password,
            role: role || 'admin'
        });

        await newAdmin.save();
        res.status(201).json({ message: `Admin (${newAdmin.role}) registered successfully`, admin: { id: newAdmin.id, email: newAdmin.email, role: newAdmin.role } });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error during admin creation');
    }
});

router.get('/admin-management/all-admins', protect, authorize('superadmin'), async (req, res) => {
    try {
        const admins = await Admin.find().select('-password');
        res.json(admins);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.put('/admin-management/:id/change-role', protect, authorize('superadmin'), [
    check('role', 'New role is required and must be "admin" or "superadmin"').isIn(['admin', 'superadmin'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { role } = req.body;

    try {
        const adminToUpdate = await Admin.findById(req.params.id);

        if (!adminToUpdate) {
            return res.status(404).json({ message: 'Admin user not found' });
        }

        if (adminToUpdate._id.toString() === req.user.id && role === 'admin') {
            return res.status(400).json({ message: 'Super Admin cannot demote themselves. Ask another Super Admin.' });
        }

        adminToUpdate.role = role;
        await adminToUpdate.save();

        res.json({ message: `Admin ${adminToUpdate.email} role updated to ${role}`, admin: adminToUpdate });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Admin ID' });
        }
        res.status(500).send('Server error');
    }
});

router.delete('/admin-management/:id', protect, authorize('superadmin'), async (req, res) => {
    try {
        const adminToDelete = await Admin.findById(req.params.id);

        if (!adminToDelete) {
            return res.status(404).json({ message: 'Admin user not found' });
        }

        if (adminToDelete._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Super Admin cannot delete themselves. Ask another Super Admin.' });
        }

        const superAdminsCount = await Admin.countDocuments({ role: 'superadmin' });
        if (adminToDelete.role === 'superadmin' && superAdminsCount <= 1) {
             return res.status(400).json({ message: 'Cannot delete the last Super Admin. Create another Super Admin first.' });
        }


        await adminToDelete.deleteOne();
        res.json({ message: `Admin user ${adminToDelete.email} deleted successfully` });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Admin ID' });
        }
        res.status(500).send('Server error');
    }
});

module.exports = router;

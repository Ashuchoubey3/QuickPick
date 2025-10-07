const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 

const sellerSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot be more than 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/, 'Please enter a valid email address']
    },
    mobileNumber: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true,
        match: [/^\d{10}$/, 'Please enter a valid 10-digit mobile number'] // Assumes 10-digit mobile numbers
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    shopName: {
        type: String,
        required: [true, 'Shop name is required'],
        trim: true,
        unique: true,
        maxlength: [100, 'Shop name cannot be more than 100 characters']
    },
    shopAddress: {
        type: String,
        required: [true, 'Shop address is required'],
        trim: true,
        maxlength: [200, 'Shop address cannot be more than 200 characters']
    },
    gstNumber: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number'] 
    },
    role: {
        type: String,
        default: 'seller',
        enum: ['seller'] 
    },
    isApproved: {
        type: Boolean,
        default: false 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

sellerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

sellerSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const Seller = mongoose.model('Seller', sellerSchema);

module.exports = Seller;
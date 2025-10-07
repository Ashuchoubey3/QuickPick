const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    participants: [{ 
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }],
    participantRoles: { 
        buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' }
    },
    productId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    lastMessageText: {
        type: String,
        default: null
    },
    lastMessageSenderId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    lastMessageTimestamp: {
        type: Date,
        default: Date.now
    },
    buyerUnreadCount: {
        type: Number,
        default: 0
    },
    sellerUnreadCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true }); 

chatRoomSchema.index({ participants: 1 }, { unique: true });

chatRoomSchema.pre('save', function(next) {
    if (this.isModified('participants')) {
        this.participants.sort((a, b) => a.toString().localeCompare(b.toString()));
    }
    this.updatedAt = Date.now();
    next();
});


const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;

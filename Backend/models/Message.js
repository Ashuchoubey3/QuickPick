const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatRoom: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatRoom',
        required: true
    },
    sender: { 
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderModel: { 
        type: String,
        required: true,
        enum: ['Customer', 'Seller']
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

messageSchema.index({ chatRoom: 1, timestamp: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;

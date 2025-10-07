const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');  
const Customer = require('../models/Customer');
const Seller = require('./../models/Seller');     
const Product = require('../models/Product');

router.post('/initiate', protect, authorize(['buyer', 'seller']), [
    check('participantId', 'Participant ID is required').not().isEmpty(),
    check('productId', 'Product ID is optional').optional().isMongoId()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { participantId, productId } = req.body; 
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    let buyerId, sellerId;

    if (currentUserRole === 'buyer') {
        buyerId = currentUserId;
        sellerId = participantId;
    } else if (currentUserRole === 'seller') {
        sellerId = currentUserId;
        buyerId = participantId;
    } else {
        return res.status(403).json({ message: 'Forbidden: Only buyers and sellers can initiate chats.' });
    }

    try {
        const buyerExists = await Customer.findById(buyerId);
        const sellerExists = await Seller.findById(sellerId);
        if (!buyerExists || !sellerExists) {
            return res.status(404).json({ message: 'One or both participants not found.' });
        }

        const participants = [buyerId, sellerId].sort((a, b) => a.toString().localeCompare(b.toString()));

        let chatRoom = await ChatRoom.findOne({ participants: participants });

        if (chatRoom) {
            res.status(200).json({
                message: 'Existing chat retrieved.',
                chatId: chatRoom._id,
                participants: { buyerId: chatRoom.participantRoles.buyerId, sellerId: chatRoom.participantRoles.sellerId, productId: chatRoom.productId }
            });
        } else {
            chatRoom = new ChatRoom({
                participants: participants,
                participantRoles: { buyerId, sellerId },
                productId: productId || null,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await chatRoom.save();
            res.status(201).json({
                message: 'Chat initiated successfully.',
                chatId: chatRoom._id,
                participants: { buyerId: chatRoom.participantRoles.buyerId, sellerId: chatRoom.participantRoles.sellerId, productId: chatRoom.productId }
            });
        }
    } catch (error) {
        console.error('Error initiating chat:', error.message);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Chat already exists for these participants.' });
        }
        res.status(500).send('Server error initiating chat');
    }
});

router.get('/list', protect, authorize(['buyer', 'seller']), async (req, res) => {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    try {
        const chats = await ChatRoom.find({ participants: currentUserId })
            .populate('productId', 'name') 
            .sort({ updatedAt: -1 });

        const chatList = [];

        for (const chat of chats) {
            let otherParticipantId;
            let otherParticipantName = 'Unknown User';
            let otherParticipantType = ''; 

            if (currentUserRole === 'buyer') {
                otherParticipantId = chat.participantRoles.sellerId;
                const sellerDoc = await Seller.findById(otherParticipantId).select('shopName firstName lastName');
                otherParticipantName = sellerDoc ? (sellerDoc.shopName || `${sellerDoc.firstName} ${sellerDoc.lastName}`) : 'Deleted Seller';
                otherParticipantType = 'Seller';
            } else if (currentUserRole === 'seller') {
                otherParticipantId = chat.participantRoles.buyerId;
                const buyerDoc = await Customer.findById(otherParticipantId).select('firstName lastName');
                otherParticipantName = buyerDoc ? `${buyerDoc.firstName} ${buyerDoc.lastName}` : 'Deleted Buyer'; // Changed from 'Deleted Customer' to 'Deleted Buyer' for clarity
                otherParticipantType = 'Customer';
            }


            chatList.push({
                chatId: chat._id,
                otherParticipantId,
                otherParticipantName,
                otherParticipantType,
                lastMessageText: chat.lastMessageText,
                lastMessageSenderId: chat.lastMessageSenderId,
                lastMessageTimestamp: chat.lastMessageTimestamp,
                unreadCount: currentUserRole === 'buyer' ? chat.buyerUnreadCount : chat.sellerUnreadCount,
                productName: chat.productId ? chat.productId.name : null, 
                productId: chat.productId ? chat.productId._id : null
            });
        }
        res.status(200).json(chatList);
    } catch (error) {
        console.error('Error listing chats:', error.message);
        res.status(500).send('Server error listing chats');
    }
});

router.get('/messages/:chatId', protect, authorize(['buyer', 'seller']), async (req, res) => {
    const { chatId } = req.params;
    const currentUserId = req.user.id;

    try {
        const chatRoom = await ChatRoom.findById(chatId);
        if (!chatRoom) {
            return res.status(404).json({ message: 'Chat room not found.' });
        }

        if (!chatRoom.participants.includes(currentUserId)) {
            return res.status(403).json({ message: 'Forbidden: You are not a participant in this chat.' });
        }

        const messages = await Message.find({ chatRoom: chatId })
            .sort({ timestamp: 1 })
            .select('-__v'); 

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Chat ID' });
        }
        res.status(500).send('Server error fetching messages');
    }
});

router.post('/:chatId/mark-read', protect, authorize(['buyer', 'seller']), async (req, res) => {
    const { chatId } = req.params;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    try {
        const chatRoom = await ChatRoom.findById(chatId);
        if (!chatRoom) {
            return res.status(404).json({ message: 'Chat room not found.' });
        }

        if (!chatRoom.participants.includes(currentUserId)) {
            return res.status(403).json({ message: 'Forbidden: You are not a participant in this chat.' });
        }

        let updateField = '';
        if (currentUserRole === 'buyer' && chatRoom.participantRoles.buyerId.toString() === currentUserId) {
            if (chatRoom.buyerUnreadCount > 0) {
                updateField = 'buyerUnreadCount';
            }
        } else if (currentUserRole === 'seller' && chatRoom.participantRoles.sellerId.toString() === currentUserId) {
            if (chatRoom.sellerUnreadCount > 0) {
                updateField = 'sellerUnreadCount';
            }
        }

        if (updateField) {
            chatRoom[updateField] = 0;
            await chatRoom.save();
            return res.status(200).json({ message: 'Chat marked as read.' });
        } else {
            return res.status(200).json({ message: 'No unread messages to mark.' });
        }

    } catch (error) {
        console.error('Error marking chat as read:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Chat ID' });
        }
        res.status(500).send('Server error marking chat as read');
    }
});


module.exports = router;

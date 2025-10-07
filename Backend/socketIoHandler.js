const ChatRoom = require('./models/ChatRoom');
const Message = require('./models/Message');
const Customer = require('./models/Customer');
const Seller = require('./models/Seller');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on('joinChat', async (chatId) => {
            socket.join(chatId);
            console.log(`User ${socket.id} joined chat room: ${chatId}`);

            try {

                const chatRoom = await ChatRoom.findById(chatId);
                if (chatRoom) {
                    const userId = socket.handshake.query.userId; 
                    const userRole = socket.handshake.query.userRole;

                    if (userId) {
                        if (userRole === 'buyer' && chatRoom.participantRoles.buyerId.toString() === userId) {
                            if (chatRoom.buyerUnreadCount > 0) {
                                chatRoom.buyerUnreadCount = 0;
                                await chatRoom.save();
                                console.log(`Buyer unread count reset for chat ${chatId}`);
                            }
                        } else if (userRole === 'seller' && chatRoom.participantRoles.sellerId.toString() === userId) {
                            if (chatRoom.sellerUnreadCount > 0) {
                                chatRoom.sellerUnreadCount = 0;
                                await chatRoom.save();
                                console.log(`Seller unread count reset for chat ${chatId}`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error marking messages as read on join:', error);
            }
        });

        socket.on('sendMessage', async (message) => {
            try {
                console.log(`Received message for chat ${message.chatId} from ${message.senderId}: ${message.text}`);

                if (!message.chatId || !message.senderId || !message.text || !message.senderRole) {
                    console.error('Invalid message format received:', message);
                    socket.emit('messageFailed', { error: 'Invalid message format' });
                    return;
                }

                const chatRoom = await ChatRoom.findById(message.chatId);
                if (!chatRoom) {
                    console.error(`Chat room ${message.chatId} not found.`);
                    socket.emit('messageFailed', { error: 'Chat room not found' });
                    return;
                }

                let senderModel;
                const isBuyer = chatRoom.participantRoles.buyerId.toString() === message.senderId;
                const isSeller = chatRoom.participantRoles.sellerId.toString() === message.senderId;

                if (isBuyer && message.senderRole === 'buyer') {
                    senderModel = 'Customer';
                } else if (isSeller && message.senderRole === 'seller') {
                    senderModel = 'Seller';
                } else {
                    console.error(`Sender ${message.senderId} is not a valid participant or role mismatch in chat ${message.chatId}.`);
                    socket.emit('messageFailed', { error: 'Not authorized to send messages in this chat or role mismatch' });
                    return;
                }

                const newMessage = new Message({
                    chatRoom: message.chatId,
                    sender: message.senderId,
                    senderModel: senderModel,  
                    text: message.text,
                    timestamp: new Date()
                });

                await newMessage.save();

                chatRoom.lastMessageText = message.text;
                chatRoom.lastMessageSenderId = message.senderId;
                chatRoom.lastMessageTimestamp = newMessage.timestamp;
                chatRoom.updatedAt = new Date();

                if (isBuyer) {
                    chatRoom.sellerUnreadCount += 1;
                    chatRoom.buyerUnreadCount = 0;
                } else if (isSeller) {
                    chatRoom.buyerUnreadCount += 1;
                    chatRoom.sellerUnreadCount = 0;
                }
                
                await chatRoom.save(); 
                io.to(chatRoom._id.toString()).emit('receiveMessage', {
                    id: newMessage._id,
                    chatRoom: chatRoom._id.toString(),
                    sender: newMessage.sender.toString(),
                    text: newMessage.text,
                    timestamp: newMessage.timestamp.toISOString(),
                    senderModel: newMessage.senderModel 
                });

            } catch (error) {
                console.error('Error sending message:', error);
                if (error.name === 'ValidationError') {
                    const validationErrors = Object.keys(error.errors).map(key => error.errors[key].message);
                    socket.emit('messageFailed', { error: `Message validation failed: ${validationErrors.join(', ')}` });
                } else {
                    socket.emit('messageFailed', { error: error.message || 'Failed to send message due to server error.' });
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
};

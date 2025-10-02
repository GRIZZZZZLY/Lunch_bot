"use strict";
async;
createUser(data, CreateUserData);
Promise < User > {
    try: {
        const: user = await prisma.user.create({
            data: {
                telegramId: BigInt(data.telegramId),
                username: data.username,
                firstName: data.firstName,
                lastName: data.lastName,
                isAdmin: false,
                isActive: true,
            },
        }),
        logger, : .info(`User created: ${user.telegramId} (${user.firstName})`),
        return: user
    }, catch(error) {
        logger.error('Error creating user:', error);
        throw new Error('Failed to create user');
    }
};
//# sourceMappingURL=user.service.additions.js.map
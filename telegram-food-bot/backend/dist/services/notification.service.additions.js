"use strict";
async;
notifyResponsible(pollId, number, userId, number);
Promise < void  > {
    try: {
        const: user = await prisma.user.findUnique({
            where: { id: userId },
        }),
        if(, user) {
            logger.warn(`User ${userId} not found for notification`);
            return;
        },
        const: poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                group: true,
                result: {
                    include: {
                        winnerMenuItem: true,
                    },
                },
            },
        }),
        if(, poll) {
            logger.warn(`Poll ${pollId} not found for notification`);
            return;
        },
        const: message =
            `🎉 Поздравляем! Вы выбраны ответственным за заказ!\n\n` +
                `🍽️ Заказываем: ${poll.result?.winnerMenuItem?.name || 'выбранное блюдо'}\n` +
                `👥 Группа: ${poll.group.title}\n\n` +
                `📞 Пожалуйста, оформите заказ! 🚀`,
        logger, : .info(`Notification sent to user ${userId} for poll ${pollId}`)
    }, catch(error) {
        logger.error('Error notifying responsible:', error);
    }
};
//# sourceMappingURL=notification.service.additions.js.map
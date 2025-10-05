"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompactPollKeyboard = createCompactPollKeyboard;
exports.createPollKeyboard = createPollKeyboard;
exports.createCompletedPollKeyboard = createCompletedPollKeyboard;
exports.createPollAdminKeyboard = createPollAdminKeyboard;
exports.createCategorizedPollKeyboard = createCategorizedPollKeyboard;
exports.createResultsKeyboard = createResultsKeyboard;
exports.createCompactPollMessage = createCompactPollMessage;
exports.createPollMessage = createPollMessage;
exports.createResultsMessage = createResultsMessage;
function createCompactPollKeyboard(pollId) {
    return {
        inline_keyboard: [
            [{ text: '📱 Проголосовать', callback_data: `openpoll:${pollId}` }],
            [{ text: '📊 Результаты', callback_data: `show_results:${pollId}` }]
        ]
    };
}
function createPollKeyboard(pollId, menuItems, votes) {
    const keyboard = [];
    for (let i = 0; i < menuItems.length; i += 2) {
        const row = [];
        for (let j = i; j < Math.min(i + 2, menuItems.length); j++) {
            const item = menuItems[j];
            const itemVotes = votes.get(item.id) || [];
            const voteText = itemVotes.length > 0 ? ` (${itemVotes.length})` : '';
            row.push({
                text: `${item.name}${voteText}`,
                callback_data: `vote:${pollId}:${item.id}`
            });
        }
        keyboard.push(row);
    }
    keyboard.push([
        { text: '🏠 Принесу из дома', callback_data: `vote:bring_own:${pollId}` },
        { text: '⏭️ Не обедаю', callback_data: `vote:skip:${pollId}` }
    ]);
    keyboard.push([
        { text: '🔄 Обновить', callback_data: `refresh_poll:${pollId}` },
        { text: '📊 Результаты', callback_data: `show_results:${pollId}` }
    ]);
    return { inline_keyboard: keyboard };
}
function createCompletedPollKeyboard(pollId, hasVotes = false, isRouletteRun = false) {
    const keyboard = [
        [{ text: '📊 Подробные результаты', callback_data: `show_results:${pollId}` }]
    ];
    if (hasVotes && !isRouletteRun) {
        keyboard.push([
            { text: '🎲 Запустить рулетку', callback_data: `run_roulette:${pollId}` }
        ]);
    }
    return { inline_keyboard: keyboard };
}
function createPollAdminKeyboard(pollId, isActive = true) {
    const keyboard = [];
    if (isActive) {
        keyboard.push([
            { text: '✅ Завершить голосование', callback_data: `complete_poll:${pollId}` },
            { text: '❌ Отменить', callback_data: `cancel_poll:${pollId}` }
        ]);
        keyboard.push([
            { text: '📊 Промежуточные результаты', callback_data: `show_results:${pollId}` }
        ]);
    }
    else {
        keyboard.push([
            { text: '📊 Результаты', callback_data: `show_results:${pollId}` },
            { text: '🎲 Рулетка', callback_data: `run_roulette:${pollId}` }
        ]);
    }
    return { inline_keyboard: keyboard };
}
function createCategorizedPollKeyboard(pollId, menuItemsByCategory, votes, selectedCategory) {
    const keyboard = [];
    const categories = Object.keys(menuItemsByCategory);
    if (!selectedCategory && categories.length > 1) {
        for (let i = 0; i < categories.length; i += 2) {
            const row = [];
            for (let j = i; j < Math.min(i + 2, categories.length); j++) {
                const category = categories[j];
                const categoryItems = menuItemsByCategory[category];
                row.push({
                    text: `📂 ${category} (${categoryItems.length})`,
                    callback_data: `poll_category:${pollId}:${encodeURIComponent(category)}`
                });
            }
            keyboard.push(row);
        }
        keyboard.push([
            { text: '📋 Показать все блюда', callback_data: `poll_show_all:${pollId}` }
        ]);
    }
    else {
        const itemsToShow = selectedCategory
            ? menuItemsByCategory[selectedCategory] || []
            : Object.values(menuItemsByCategory).flat();
        for (let i = 0; i < itemsToShow.length; i += 2) {
            const row = [];
            for (let j = i; j < Math.min(i + 2, itemsToShow.length); j++) {
                const item = itemsToShow[j];
                const itemVotes = votes.get(item.id) || [];
                const voteText = itemVotes.length > 0 ? ` (${itemVotes.length})` : '';
                row.push({
                    text: `${item.name}${voteText}`,
                    callback_data: `vote:${pollId}:${item.id}`
                });
            }
            keyboard.push(row);
        }
        if (selectedCategory && categories.length > 1) {
            keyboard.push([
                { text: '← Назад к категориям', callback_data: `poll_categories:${pollId}` }
            ]);
        }
    }
    keyboard.push([
        { text: '🔄 Обновить', callback_data: `refresh_poll:${pollId}` },
        { text: '📊 Результаты', callback_data: `show_results:${pollId}` }
    ]);
    return { inline_keyboard: keyboard };
}
function createResultsKeyboard(pollId, hasVotes, isActive, isRouletteRun = false) {
    const keyboard = [];
    if (isActive) {
        keyboard.push([
            { text: '🔄 Обновить', callback_data: `refresh_poll:${pollId}` },
            { text: '🗳️ К голосованию', callback_data: `show_poll:${pollId}` }
        ]);
        keyboard.push([
            { text: '✅ Завершить голосование', callback_data: `complete_poll:${pollId}` }
        ]);
    }
    else {
        if (hasVotes && !isRouletteRun) {
            keyboard.push([
                { text: '🎲 Запустить рулетку', callback_data: `run_roulette:${pollId}` }
            ]);
        }
        keyboard.push([
            { text: '📈 Подробная статистика', callback_data: `poll_detailed_stats:${pollId}` }
        ]);
    }
    return { inline_keyboard: keyboard };
}
function createCompactPollMessage(poll, itemCount, currentVotes = 0, totalMembers = 0) {
    let message = `🗳️ **Голосование началось!**\n\n`;
    if (poll.title && poll.title !== 'Голосование за обед') {
        message += `📋 ${poll.title}\n`;
    }
    message += `🍽️ Блюд в меню: ${itemCount}\n`;
    if (poll.duration) {
        message += `⏰ Длительность: ${poll.duration} мин\n`;
    }
    if (totalMembers > 0) {
        message += `👥 Участвуют: ${currentVotes} из ${totalMembers}\n`;
    }
    else {
        message += `👥 Проголосовало: ${currentVotes}\n`;
    }
    message += `\n📱 Нажмите кнопку ниже для голосования`;
    return message;
}
function createPollMessage(pollData) {
    const { poll, menuItems, votes, totalVotes } = pollData;
    let message = `🗳️ **${poll.title}**\n\n`;
    if (poll.description) {
        message += `📝 ${poll.description}\n\n`;
    }
    message += `👥 **Участников:** ${totalVotes}\n`;
    if (poll.endTime && poll.status === 'ACTIVE') {
        const timeLeft = Math.max(0, Math.floor((new Date(poll.endTime).getTime() - Date.now()) / 1000 / 60));
        message += `⏰ **Осталось:** ${timeLeft} мин\n`;
    }
    message += `\n📋 **Блюда в голосовании:**\n`;
    const sortedItems = menuItems
        .map(item => ({
        ...item,
        voteCount: votes.get(item.id)?.length || 0
    }))
        .sort((a, b) => b.voteCount - a.voteCount);
    sortedItems.forEach((item, index) => {
        const voteCount = item.voteCount;
        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
        const bar = createProgressBar(percentage);
        message += `${index + 1}. **${item.name}**\n`;
        if (item.description && item.description.length < 50) {
            message += `   _${item.description}_\n`;
        }
        if (item.price) {
            message += `   💰 ${item.price}₽\n`;
        }
        message += `   ${bar} ${voteCount} голосов (${percentage}%)\n\n`;
    });
    if (totalVotes === 0) {
        message += `💡 _Будьте первыми - проголосуйте за понравившееся блюдо!_\n\n`;
    }
    message += `⚡ Нажмите кнопку ниже, чтобы проголосовать`;
    return message;
}
function createProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
function createResultsMessage(pollData) {
    const { poll, result, breakdown, totalVotes, voteTypeStats } = pollData;
    let message = `📊 **Результаты голосования**\n\n`;
    message += `🎯 **"${poll.title}"**\n`;
    message += `👥 Участников: ${totalVotes}\n`;
    if (poll.status === 'ACTIVE') {
        message += `🔴 Голосование активно\n`;
        if (poll.endTime) {
            const timeLeft = Math.max(0, Math.floor((new Date(poll.endTime).getTime() - Date.now()) / 1000 / 60));
            message += `⏰ Осталось: ${timeLeft} мин\n`;
        }
    }
    else {
        message += `✅ Голосование завершено\n`;
        if (result?.winnerItem) {
            message += `🏆 **Победитель:** ${result.winnerMenuItem.name}\n`;
        }
    }
    if (voteTypeStats && voteTypeStats.total > 0) {
        message += `\n📈 **Статистика:**\n`;
        message += `🍽️ Заказывают: ${voteTypeStats.menuItemVotes}\n`;
        if (voteTypeStats.bringOwnVotes > 0) {
            message += `🏠 Принесут из дома: ${voteTypeStats.bringOwnVotes}\n`;
        }
        if (voteTypeStats.skipVotes > 0) {
            message += `⏭️ Не обедают: ${voteTypeStats.skipVotes}\n`;
        }
    }
    message += `\n📋 **Результаты по блюдам:**\n\n`;
    if (breakdown.length === 0) {
        message += `😔 _Никто не проголосовал_`;
        return message;
    }
    breakdown.forEach((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const bar = createProgressBar(item.percentage);
        message += `${medal} **${item.menuItemName}**\n`;
        message += `   ${bar} ${item.votes} голосов (${item.percentage}%)\n`;
        if (item.voters.length <= 5) {
            const voterNames = item.voters.map((v) => v.firstName).join(', ');
            message += `   👤 ${voterNames}\n`;
        }
        else {
            const firstVoters = item.voters.slice(0, 3).map((v) => v.firstName).join(', ');
            message += `   👤 ${firstVoters} и ещё ${item.voters.length - 3}\n`;
        }
        message += `\n`;
    });
    if (result?.responsible) {
        message += `🎲 **Ответственный за заказ:** ${result.responsibleUser.firstName}\n`;
    }
    return message;
}
//# sourceMappingURL=poll.keyboard.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPriority = exports.NotificationType = void 0;
var NotificationType;
(function (NotificationType) {
    NotificationType["POLL_STARTED"] = "poll_started";
    NotificationType["POLL_ENDING_SOON"] = "poll_ending_soon";
    NotificationType["POLL_ENDED"] = "poll_ended";
    NotificationType["POLL_CANCELLED"] = "poll_cancelled";
    NotificationType["ROULETTE_WINNER"] = "roulette_winner";
    NotificationType["ORDER_REMINDER"] = "order_reminder";
    NotificationType["CUSTOM"] = "custom";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "low";
    NotificationPriority["NORMAL"] = "normal";
    NotificationPriority["HIGH"] = "high";
    NotificationPriority["URGENT"] = "urgent";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
//# sourceMappingURL=notification.types.js.map
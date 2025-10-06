export declare const botConfig: {
    token: string;
    webhookUrl: string;
    secretKey: string;
    mode: string;
    polling: {
        interval: number;
        timeout: number;
        limit: number;
    };
    webhook: {
        port: number;
        path: string;
        ssl: {
            enabled: boolean;
            cert: string;
            key: string;
        };
    };
    limits: {
        userRequestsPerMinute: number;
        maxMessageLength: number;
        maxPollParticipants: number;
        defaultPollDuration: number;
    };
    commands: {
        enableInGroups: boolean;
        enableInPrivate: boolean;
        prefix: string;
    };
    logging: {
        level: string;
        logAllMessages: boolean;
        logCallbacks: boolean;
    };
    defaultAdmins: string[];
    miniApp: {
        url: string;
        shortName: string;
    };
    webappUrl: string;
    features: {
        enablePolls: boolean;
        enableRoulette: boolean;
        enableStats: boolean;
        enableNotifications: boolean;
    };
    messages: {
        welcome: string;
        noPermission: string;
        error: string;
    };
};
export default botConfig;
//# sourceMappingURL=bot.config.d.ts.map
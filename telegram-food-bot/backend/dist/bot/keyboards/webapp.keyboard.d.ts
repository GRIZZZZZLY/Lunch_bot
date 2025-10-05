export declare function createWebAppButton(text: string, path?: string): {
    text: string;
    web_app: {
        url: string;
    };
};
export declare function createVoteWebAppKeyboard(pollId: number): {
    inline_keyboard: {
        text: string;
        web_app: {
            url: string;
        };
    }[][];
};
export declare function createMenuWebAppKeyboard(): {
    inline_keyboard: {
        text: string;
        web_app: {
            url: string;
        };
    }[][];
};
export declare function createPollWebAppKeyboard(): {
    inline_keyboard: {
        text: string;
        web_app: {
            url: string;
        };
    }[][];
};
export declare function createResultsWebAppKeyboard(pollId: number): {
    inline_keyboard: {
        text: string;
        web_app: {
            url: string;
        };
    }[][];
};
export declare function createPollActionsKeyboard(pollId: number, showResults?: boolean): {
    inline_keyboard: {
        text: string;
        web_app: {
            url: string;
        };
    }[][];
};
export declare function createResponsibleKeyboard(pollId: number): {
    inline_keyboard: {
        text: string;
        web_app: {
            url: string;
        };
    }[][];
};
//# sourceMappingURL=webapp.keyboard.d.ts.map
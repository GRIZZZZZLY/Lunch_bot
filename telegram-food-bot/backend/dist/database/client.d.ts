import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const testConnection: () => Promise<boolean>;
export declare const disconnect: () => Promise<void>;
export default prisma;
//# sourceMappingURL=client.d.ts.map
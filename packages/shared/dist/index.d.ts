export type ID = string;
export interface User {
    id: ID;
    email: string;
    handle: string | null;
    name: string | null;
    bio: string | null;
    avatar: string | null;
    settings: Record<string, unknown> | null;
    created_at: string;
}
export type Role = 'system' | 'user' | 'assistant' | 'tool';

import { Poll, Vote, PollResult, Group, User, MenuItem } from '@prisma/client';

export interface CreatePollData {
  groupId: number;
  duration: number;
  createdBy: number;
  title?: string;
  description?: string;
}

export interface UpdatePollData {
  title?: string;
  description?: string;
  endTime?: Date;
  messageId?: string;
  isActive?: boolean;
}

export interface PollWithDetails extends Poll {
  group: Group;
  votes: VoteWithDetails[];
  results?: PollResultWithDetails[];
  _count: {
    votes: number;
  };
}

export interface VoteWithDetails extends Vote {
  user: User;
  menuItem: MenuItem | null;
}

export interface PollResultWithDetails extends PollResult {
  poll: PollWithGroup;
  winnerItem?: MenuItem;
  responsible?: User;
}

export interface PollWithGroup extends Poll {
  group: Group;
  votes?: VoteWithDetails[];
}

export interface CreateVoteData {
  pollId: number;
  userId: number;
  menuItemId: number;
}

export interface PollStats {
  totalPolls: number;
  activePolls: number;
  completedPolls: number;
  totalVotes: number;
  averageParticipants: number;
}

export interface VoteBreakdown {
  menuItemId: number;
  menuItemName: string;
  votes: number;
  percentage: number;
  voters: VoterInfo[];
}

export interface VoterInfo {
  id: number;
  firstName: string;
  username?: string;
}

export interface PollMessage {
  pollId: number;
  title: string;
  description?: string;
  menuItems: MenuItem[];
  votes: Map<number, VoteWithDetails[]>;
  totalVotes: number;
  endTime?: Date;
  isActive: boolean;
}

export interface RouletteResult {
  pollResult: PollResultWithDetails;
  selectedUser: User;
  allVoters: User[];
  winnerItem?: MenuItem;
}

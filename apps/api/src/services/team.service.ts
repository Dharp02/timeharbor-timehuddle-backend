import { ObjectId } from "mongodb";
import {
  teamsCollection,
  membersCollection,
  notificationsCollection,
  notificationPreferencesCollection,
} from "../models/index.js";
import type { Team, Member } from "../models/team.model.js";

function generateTeamCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class TeamService {
  async create(name: string, userId: string): Promise<Team> {
    let code = generateTeamCode();
    while (await teamsCollection().findOne({ code })) {
      code = generateTeamCode();
    }

    const now = new Date();
    const team: Team = {
      _id: new ObjectId(),
      name,
      code,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await teamsCollection().insertOne(team);

    const member: Member = {
      _id: new ObjectId(),
      userId,
      teamId: team._id.toHexString(),
      role: "Leader",
      joinedAt: now,
    };
    await membersCollection().insertOne(member);

    return team;
  }

  async findByUser(userId: string): Promise<Team[]> {
    const memberships = await membersCollection()
      .find({ userId })
      .toArray();
    const teamIds = memberships.map((m) => new ObjectId(m.teamId));
    if (teamIds.length === 0) return [];
    return teamsCollection().find({ _id: { $in: teamIds } }).toArray();
  }

  async findById(id: string): Promise<Team | null> {
    return teamsCollection().findOne({ _id: new ObjectId(id) });
  }

  async update(id: string, name: string): Promise<boolean> {
    const result = await teamsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async delete(id: string): Promise<boolean> {
    await membersCollection().deleteMany({ teamId: id });
    await notificationsCollection().deleteMany({ teamId: id });
    await notificationPreferencesCollection().deleteMany({ teamId: id });
    const result = await teamsCollection().deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  async joinByCode(code: string, userId: string): Promise<Team | null> {
    const team = await teamsCollection().findOne({ code });
    if (!team) return null;

    const existing = await membersCollection().findOne({
      userId,
      teamId: team._id.toHexString(),
    });
    if (existing) return team;

    const member: Member = {
      _id: new ObjectId(),
      userId,
      teamId: team._id.toHexString(),
      role: "Member",
      joinedAt: new Date(),
    };
    await membersCollection().insertOne(member);

    await notificationsCollection().insertOne({
      _id: new ObjectId(),
      userId: team.createdBy,
      teamId: team._id.toHexString(),
      type: "team_join",
      title: "New member joined",
      body: `A new member joined your team "${team.name}"`,
      readAt: null,
      createdAt: new Date(),
    });

    return team;
  }

  async getMembers(teamId: string) {
    return membersCollection().find({ teamId }).toArray();
  }

  async getMembership(userId: string, teamId: string): Promise<Member | null> {
    return membersCollection().findOne({ userId, teamId });
  }

  async addMember(teamId: string, userId: string, role: "Leader" | "Member" = "Member"): Promise<Member> {
    const existing = await membersCollection().findOne({ userId, teamId });
    if (existing) return existing;

    const member: Member = {
      _id: new ObjectId(),
      userId,
      teamId,
      role,
      joinedAt: new Date(),
    };
    await membersCollection().insertOne(member);
    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const result = await membersCollection().deleteOne({ userId, teamId });
    return result.deletedCount > 0;
  }

  async updateMemberRole(teamId: string, userId: string, role: "Leader" | "Member"): Promise<boolean> {
    const result = await membersCollection().updateOne(
      { userId, teamId },
      { $set: { role } }
    );
    return result.modifiedCount > 0;
  }

  async isLeader(teamId: string, userId: string): Promise<boolean> {
    const member = await membersCollection().findOne({ userId, teamId });
    return member?.role === "Leader";
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    const member = await membersCollection().findOne({ userId, teamId });
    return member !== null;
  }
}

export const teamService = new TeamService();

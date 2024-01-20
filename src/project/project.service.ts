import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeleteResult, Repository } from 'typeorm';
import { Project } from './entity/project.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entity/user.entity';
import { UserService } from 'src/user/user.service';
import { SectionService } from 'src/section/section.service';
import { Section } from 'src/section/entity/section.entity';
import { CreateProjectRequest } from './dtos/create.project.dto';
import { AssignUserProjectRequest } from './dtos/assign.user.project.dto';
import {
  InviteUserProjectRequest,
  InviteUserProjectResponse,
} from './dtos/invite.user.project.dto';
import nodemailer from 'nodemailer';
import { CreateUserResponse } from 'src/user/dtos/create.user.dto';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly sectionService: SectionService,
    private readonly userService: UserService,
  ) {}

  private getProjectsBaseQuery() {
    return this.projectRepository
      .createQueryBuilder('e')
      .orderBy('e.id', 'DESC');
  }

  private updateTeamUser(project: Project, member: CreateUserResponse) {
    const updatedTeamUsers: Array<string> = [...project.teamUsers];
    if (
      !updatedTeamUsers.some(
        (existingMember: string) => existingMember === member.id,
      )
    ) {
      updatedTeamUsers.push(member.id);
    }

    return updatedTeamUsers;
  }

  public async getAllProjects() {
    return await this.getProjectsBaseQuery().getMany();
  }

  public async getProjectDetail(id: string): Promise<Project> {
    const query = await this.getProjectsBaseQuery().andWhere('e.id = :id', {
      id,
    });
    const project = await query.getOne();
    if (project) {
      const sectionsPromises: Promise<Section>[] = project.sections.map(
        async (section: Section) => {
          return await this.sectionService.getSection(section.id);
        },
      );
      const sections: Section[] = await Promise.all(sectionsPromises);
      return { ...project, sections };
    } else {
      throw new NotFoundException();
    }
  }

  public async createProject(
    input: CreateProjectRequest,
    user: User,
  ): Promise<Project> {
    const sectionsPromises: Promise<Section>[] = input.sections.map(
      async (sectionId: number) => {
        return await this.sectionService.getSection(sectionId);
      },
    );
    const sections: Section[] = await Promise.all(sectionsPromises);

    return await this.projectRepository.save({
      ...input,
      sections,
      createdBy: user.id,
    });
  }

  public async updateProject(
    project: Project,
    input: CreateProjectRequest,
    user: User,
  ): Promise<Project> {
    const sectionsPromises: Promise<Section>[] = input.sections.map(
      async (sectionId: number) => {
        return await this.sectionService.getSection(sectionId);
      },
    );
    const sections: Section[] = await Promise.all(sectionsPromises);
    return await this.projectRepository.save({
      ...project,
      ...input,
      sections,
      createdBy: user.id,
    });
  }

  public async deleteProject(id: number): Promise<DeleteResult> {
    return await this.projectRepository
      .createQueryBuilder('e')
      .delete()
      .where('id = :id', { id })
      .execute();
  }

  public async assignMemberToProject(
    memberId: AssignUserProjectRequest,
    project: Project,
    user: User,
  ): Promise<Project> {
    const member = await this.userService.getUser(memberId.userId);

    if (!member) {
      throw new BadRequestException('User not found');
    }

    const updatedTeamUsers = this.updateTeamUser(project, member);
    const sectionsPromises: Promise<Section>[] = project.sections.map(
      async (section: Section) => {
        return await this.sectionService.getSection(section.id);
      },
    );
    const sections: Section[] = await Promise.all(sectionsPromises);
    return await this.projectRepository.save({
      ...project,
      sections,
      teamUsers: updatedTeamUsers,
      createdBy: user.id,
    });
  }

  public async acceptOrReject() {
    return;
  }

  public async inviteUser(payload: InviteUserProjectRequest): Promise<boolean> {
    const member = await this.userService.getUserByEmail(payload.email);
    const project = await this.getProjectDetail(payload.projectId);

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    if (!member) {
      throw new BadRequestException('User not found');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'tambintv1@gmail.com',
        pass: 'vdba tjns zelf koqt',
      },
      port: 587,
      secure: false,
      requireTLS: true,
    });
    // domain?projectId=""&email=""
    const mailOptions = {
      from: 'tambintv1@gmail.com',
      to: payload.email,
      subject: 'Invite user to project',
      text: 'New message',
      html: `<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                <p style="font-size: '20px'; font-weight: 600;">Invite you to join ${project.title} project</p>
                <a style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: #ffffff; text-decoration: none; border-radius: 5px;" 
                    href="https://www.google.com/" 
                    target="_blank"
                >
                  Click here to join
                </a>
            </div>`,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      if (info) return true;
    } catch (error) {
      throw new BadRequestException('Error sending email');
    }
  }

  public async acceptInvite(
    payload: InviteUserProjectRequest,
  ): Promise<InviteUserProjectResponse> {
    const member = await this.userService.getUserByEmail(payload.email);
    const project = await this.getProjectDetail(payload.projectId);

    const updatedTeamUsers = this.updateTeamUser(project, member);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const updatedProject = await this.projectRepository.save({
      ...project,
      teamUsers: updatedTeamUsers,
    });

    return {
      status: true,
    };
  }
}

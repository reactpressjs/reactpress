import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class AiReview {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 36 })
  articleId: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 64 })
  skillId: string;

  @ApiProperty({ description: 'pending | approved | rejected' })
  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: string;

  @ApiProperty({ description: 'Proposed article field patch as JSON' })
  @Column({ type: 'text' })
  proposedJson: string;

  @ApiProperty({ description: 'Skill notes / pre-review checklist' })
  @Column({ type: 'text', default: null, nullable: true })
  notes: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 128, default: null, nullable: true })
  model: string;

  @ApiProperty()
  @Column({ type: 'int', default: null, nullable: true })
  approvedBy: number;

  @ApiProperty()
  @CreateDateColumn()
  createAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updateAt: Date;
}

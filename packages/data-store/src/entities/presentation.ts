import { VerifiableCredential, VerifiablePresentation } from '@veramo/core'

import { BaseEntity, Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryColumn } from 'typeorm'
import { Identifier } from './identifier'
import { Message } from './message'
import { createCredentialEntity, Credential } from './credential'
import { asArray, computeEntryHash } from '@veramo/utils'
import { normalizeCredential } from 'did-jwt-vc'

@Entity('presentation')
export class Presentation extends BaseEntity {
  @PrimaryColumn()
  //@ts-ignore
  hash: string

  //@ts-ignore
  private _raw: IVerifiablePresentation

  set raw(raw: VerifiablePresentation) {
    this._raw = raw
    this.hash = computeEntryHash(raw)
  }

  @Column({ type: 'simple-json' })
  get raw(): VerifiablePresentation {
    return this._raw
  }

  @ManyToOne((type) => Identifier, (identifier) => identifier.issuedPresentations, {
    cascade: ['insert'],
    eager: true,
    onDelete: 'CASCADE',
  })
  //@ts-ignore
  holder: Identifier

  @ManyToMany((type) => Identifier, (identifier) => identifier?.receivedPresentations, {
    cascade: ['insert'],
    eager: true,
    nullable: true,
  })
  @JoinTable()
  //@ts-ignore
  verifier?: Identifier[]

  @Column({ nullable: true })
  id?: String

  @Column()
  //@ts-ignore
  issuanceDate: Date

  @Column({ nullable: true })
  expirationDate?: Date

  @Column('simple-array')
  //@ts-ignore
  context: string[]

  @Column('simple-array')
  //@ts-ignore
  type: string[]

  @ManyToMany((type) => Credential, (credential) => credential.presentations, {
    cascade: true,
  })
  @JoinTable()
  //@ts-ignore
  credentials: Credential[]

  @ManyToMany((type) => Message, (message) => message.presentations)
  //@ts-ignore
  messages: Message[]
}

export const createPresentationEntity = (vpi: VerifiablePresentation): Presentation => {
  const vp = vpi
  const presentation = new Presentation()
  presentation.context = asArray(vp['@context'])
  presentation.type = asArray(vp.type || [])
  presentation.id = vp.id

  if (vp.issuanceDate) {
    presentation.issuanceDate = new Date(vp.issuanceDate)
  }

  if (vp.expirationDate) {
    presentation.expirationDate = new Date(vp.expirationDate)
  }

  const holder = new Identifier()
  holder.did = vp.holder
  presentation.holder = holder

  presentation.verifier = asArray(vp.verifier || []).map((verifierDid) => {
    const id = new Identifier()
    id.did = verifierDid
    return id
  })

  presentation.raw = vpi

  presentation.credentials = (vp.verifiableCredential || [])
    .map((cred) => {
      if (typeof cred === 'string') {
        return normalizeCredential(cred)
      } else {
        return <VerifiableCredential>cred
      }
    })
    .map(createCredentialEntity)
  return presentation
}

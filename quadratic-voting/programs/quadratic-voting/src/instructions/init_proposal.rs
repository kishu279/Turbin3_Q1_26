use anchor_lang::prelude::*;

use crate::state::{Dao, Proposal};

#[derive(Accounts)]
pub struct InitProposal<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub dao_account: Account<'info, Dao>,

    #[account(
        init,
        payer = creator,
        space = Proposal::DISCRIMINATOR.len() + Proposal::INIT_SPACE,
        seeds = [b"proposal", dao_account.key().as_ref(),dao_account.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal_account: Account<'info, Proposal>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitProposal<'info> {
    pub fn init(&mut self, metadata: String, bump: &InitProposalBumps) -> Result<()> {
        let dao_account = &mut self.dao_account;

        dao_account.proposal_count += 1;

        self.proposal_account.set_inner(Proposal {
            authority: self.creator.key(),
            meta_data: metadata,
            no_vote_count: 0,
            yes_vote_count: 0,
            bump: bump.proposal_account,
        });
        Ok(())
    }
}

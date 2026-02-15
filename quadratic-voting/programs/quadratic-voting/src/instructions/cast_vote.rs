use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::state::{Dao, Proposal, Vote};

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(mut)]
    pub dao_account: Account<'info, Dao>,

    #[account(mut)]
    pub proposal_account: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = Vote::DISCRIMINATOR.len() + Vote::INIT_SPACE,
        seeds = [b"vote", voter.key().as_ref(), proposal_account.key().as_ref()],
        bump
    )]
    pub vote_account: Account<'info, Vote>,

    /// The governance token mint
    pub token_mint: Account<'info, Mint>,

    /// Voter's ATA for the governance token
    /// This is derived automatically by Anchor using seeds:
    /// [voter, token_program, token_mint]
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = voter,
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> CastVote<'info> {
    pub fn cast_vote(&mut self, vote_type: u8, bump: &CastVoteBumps) -> Result<()> {
        // Get token amount from voter's ATA
        let token_amount = self.voter_token_account.amount;

        // Quadratic voting: voting credits = sqrt(token_amount)
        let voting_credits = (token_amount as f64).sqrt() as u64;

        // Update proposal vote counts based on vote type
        if vote_type == 1 {
            // Yes vote
            self.proposal_account.yes_vote_count += voting_credits;
        } else if vote_type == 0 {
            // No vote
            self.proposal_account.no_vote_count += voting_credits;
        }

        // Record the vote
        self.vote_account.set_inner(Vote {
            authority: self.voter.key(),
            bump: bump.vote_account,
            vote_credits: voting_credits,
            vote_type,
        });

        Ok(())
    }
}

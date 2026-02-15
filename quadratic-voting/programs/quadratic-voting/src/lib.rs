use anchor_lang::prelude::*;

declare_id!("nBcBobNr7oR99g5pmw1fKcRAsxLS5xbkHEJawENw9n7");

pub mod instructions;
pub mod state;

pub use instructions::*;
pub use state::*;

#[program]
pub mod quadratic_voting {
    use super::*;

    pub fn initialize_dao(ctx: Context<InitDao>, name: String) -> Result<()> {
        ctx.accounts.init(name, &ctx.bumps)?;
        Ok(())
    }
    pub fn initialize_proposal(ctx: Context<InitProposal>, metadata: String) -> Result<()> {
        ctx.accounts.init(metadata, &ctx.bumps)?;
        Ok(())
    }
    pub fn cast_vote(ctx: Context<CastVote>, vote_type: u8) -> Result<()> {
        ctx.accounts.cast_vote(vote_type, &ctx.bumps)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

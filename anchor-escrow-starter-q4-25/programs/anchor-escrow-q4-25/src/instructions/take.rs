#![allow(unused_imports)]

use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::Escrow;

#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    #[account(mut)]
    pub maker: SystemAccount<'info>,

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        close = maker,
        seeds = [b"escrow", maker.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Box<Account<'info, Escrow>>,

    // taker ata for minta and mintb
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::authority = taker,
        associated_token::mint = mint_a,
        associated_token::token_program = token_program
    )]
    pub taker_ata_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::authority = taker,
        associated_token::mint = mint_b,
        associated_token::token_program = token_program
    )]
    pub taker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,

    // maker ata for mintb
    #[account(
        init_if_needed,
        payer = taker, 
        associated_token::mint = mint_b, 
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    pub maker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,

    // get the vault
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Take<'info> {
    pub fn vault_transfer(&mut self) -> Result<()> {
        let escrow = &self.escrow;
        let maker = &self.maker.key();

        let signer_seeds:&[&[&[u8]]] = &[&[b"escrow", maker.as_ref(), &escrow.seed.to_le_bytes(), &[self.escrow.bump]]];

        let transfer_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.mint_a.to_account_info(),
            to: self.taker_ata_a.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let transfer_cpi = CpiContext::new_with_signer(self.token_program.to_account_info(), transfer_accounts, signer_seeds);
        
        transfer_checked(transfer_cpi, self.vault.amount, self.mint_a.decimals)
    }

    pub fn maker_transfer(&mut self) -> Result<()> {
        // taker deposity to maker ata b
        let transfer_accounts = TransferChecked {
            from: self.taker_ata_b.to_account_info(),
            mint: self.mint_b.to_account_info(),
            to: self.maker_ata_b.to_account_info(),
            authority: self.taker.to_account_info(),
        };

        let transfer_cpi_ctx = CpiContext::new(self.token_program.to_account_info(),
        transfer_accounts);
        
        transfer_checked(transfer_cpi_ctx, self.escrow.receive, self.mint_b.decimals)
    }

    pub fn close_vault(&mut self) -> Result<()> {
        // vault to taker mint a 
        let escrow = &self.escrow;
        let maker = &self.maker.key();

        let signer_seeds:&[&[&[u8]]] = &[&[b"escrow", maker.as_ref(), &escrow.seed.to_le_bytes(), &[self.escrow.bump]]];

        let close_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.maker.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let close_cpi = CpiContext::new_with_signer(self.token_program.to_account_info(), close_accounts, signer_seeds);

        close_account(close_cpi)?;
        Ok(())
    }
}
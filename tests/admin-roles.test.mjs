import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=source.slice(source.indexOf('let voxiStaffUserId='),source.indexOf('function showMessage'));
function fixture(rpc){const state={calls:0,updates:0};const ctx=vm.createContext({currentUser:{id:'user-a',email:'mops850@gmail.com'},supabaseClient:{rpc(...args){state.calls++;return rpc(...args);}},setSignedIn(){state.updates++;}});vm.runInContext(code,ctx);return {ctx,state};}
test('email or user metadata cannot independently grant admin UI',async()=>{const {ctx}=fixture(async()=>({data:null,error:null}));assert.equal(ctx.isAdmin(),false);await ctx.resolveVOXiStaffRole(ctx.currentUser);assert.equal(ctx.isAdmin(),false);});
test('fresh server role enables staff UI and deduplicates concurrent reads',async()=>{for(const role of ['owner','admin','helper']){const {ctx,state}=fixture(async()=>({data:role,error:null}));await Promise.all([ctx.resolveVOXiStaffRole(ctx.currentUser),ctx.resolveVOXiStaffRole(ctx.currentUser)]);assert.equal(ctx.isAdmin(),true);assert.equal(state.calls,1);assert.equal(state.updates,1);}});
test('late response from old account cannot grant rights to another account',async()=>{let resolve;const p=new Promise(r=>resolve=r);const {ctx,state}=fixture(()=>p);const request=ctx.resolveVOXiStaffRole(ctx.currentUser);ctx.currentUser={id:'user-b'};resolve({data:'owner',error:null});await request;assert.equal(ctx.isAdmin(),false);assert.equal(state.updates,0);});
test('failed role read can retry without granting permissions',async()=>{let fail=true;const {ctx,state}=fixture(async()=>{if(fail)throw Error('database unavailable');return {data:'admin',error:null};});await assert.rejects(ctx.resolveVOXiStaffRole(ctx.currentUser));assert.equal(ctx.isAdmin(),false);fail=false;await ctx.resolveVOXiStaffRole(ctx.currentUser);assert.equal(ctx.isAdmin(),true);assert.equal(state.calls,2);});

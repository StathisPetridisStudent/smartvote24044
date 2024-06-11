import React, { Component } from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import web3 from './web3';
import voting from './voting'; // Ensure this points to your contract instance

// Import local images
import messi from './images/Lionel-Messi.jpg';
import ronaldo from './images/cristiano-ronaldo.jpg';
import maradona from './images/Diego-Maradona.jpg';

const candidates = [
  { name: 'Lionel Messi', image: messi },
  { name: 'Cristiano Ronaldo', image: ronaldo },
  { name: 'Diego Maradona', image: maradona }
];

class App extends Component {
  state = {
    manager: '',
    manager2: '',
    currentAccount: '',
    votes: { 'Lionel Messi': 0, 'Cristiano Ronaldo': 0, 'Diego Maradona': 0 },
    voterVotes: 0,
    balance: '',
    message: '',
    voteHistory: [], // Add state for vote history
    historyVisible: false, // Add state to track visibility of vote history
    winner: '', // Add state for winner
    isManager: false, // Add state to check if current account is manager
    contractDisabled: false, // Add state to check if contract is disabled
    metamaskError: '' // Add state to track Metamask errors
  };

  async componentDidMount() {
    try {
      if (!window.ethereum) {
        this.setState({ metamaskError: 'Metamask is not installed.' });
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const currentAccount = accounts[0];

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const sepoliaChainId = '0xAA36A7'; // Sepolia Chain ID
      const ganacheChainId = '0x539'; // Ganache Chain ID

      if (chainId !== sepoliaChainId && chainId !== ganacheChainId) {
        this.setState({ metamaskError: 'Please connect to the Sepolia or Ganache network.' });
        return;
      }

      const manager = await voting.methods.manager().call();
      const manager2 = await voting.methods.manager2().call();
      const balance = await web3.eth.getBalance(voting.options.address);
      const voterVotes = parseInt(await voting.methods.voterVotes(currentAccount).call());
      const isManager = await voting.methods.isAuthorizedManager(currentAccount).call();
      const contractDisabled = await voting.methods.contractDisabled().call();

      const votes = {
        'Lionel Messi': parseInt(await voting.methods.votes('Lionel Messi').call()),
        'Cristiano Ronaldo': parseInt(await voting.methods.votes('Cristiano Ronaldo').call()),
        'Diego Maradona': parseInt(await voting.methods.votes('Diego Maradona').call())
      };

      const voteHistory = await voting.methods.getVoteHistory().call();

      this.setState({
        manager,
        manager2,
        balance: web3.utils.fromWei(balance, 'ether'),
        currentAccount,
        voterVotes,
        isManager,
        votes,
        contractDisabled,
        voteHistory
      });

      window.ethereum.on('accountsChanged', async (accounts) => {
        const newAccount = accounts[0];
        const isManager = await voting.methods.isAuthorizedManager(newAccount).call();
        const voterVotes = parseInt(await voting.methods.voterVotes(newAccount).call());
        this.setState({ currentAccount: newAccount, isManager, voterVotes });
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      this.setupEventListener(); // Ensure this is called only once
    } catch (error) {
      console.error("Error in componentDidMount:", error);
      this.setState({ message: 'Metamask is not installed or not connected.' });
    }
  }

  setupEventListener = () => {
    if (!this.eventListenerSet) { // Check if the listener is already set
      voting.events.VoteCasted().on('data', async (event) => {
        const updatedVotes = {
          'Lionel Messi': parseInt(await voting.methods.votes('Lionel Messi').call()),
          'Cristiano Ronaldo': parseInt(await voting.methods.votes('Cristiano Ronaldo').call()),
          'Diego Maradona': parseInt(await voting.methods.votes('Diego Maradona').call())
        };
        const balance = await web3.eth.getBalance(voting.options.address);
        const voterVotes = parseInt(await voting.methods.voterVotes(this.state.currentAccount).call());
        const { voter, proposal } = event.returnValues;

        // Display pop-up message
        alert(`${voter} voted for ${proposal}`);

        this.setState((prevState) => ({
          votes: updatedVotes,
          balance: web3.utils.fromWei(balance, 'ether'),
          voterVotes
        }));
      });
      voting.events.VotingEnded().on('data', async (event) => {
        const { winner, votesReceived } = event.returnValues;
        alert(`The winner is ${winner} with ${votesReceived} votes!`);
        this.setState({ winner, message: `The winner is ${winner} with ${votesReceived} votes!` });

        // Fetch updated vote history
        const voteHistory = await voting.methods.getVoteHistory().call();
        this.setState({ voteHistory });
      });
      this.eventListenerSet = true; // Mark the listener as set
    }
  }

  onVote = async (candidate) => {
    this.setState({ message: 'Waiting on transaction success...' });

    try {
      await voting.methods.vote(candidate).send({
        from: this.state.currentAccount,
        value: web3.utils.toWei('0.01', 'ether')
      });

      this.setState({ message: 'Vote casted successfully!' });

      // Fetch updated votes, balance, and voter votes after voting
      const votes = {
        'Lionel Messi': parseInt(await voting.methods.votes('Lionel Messi').call()),
        'Cristiano Ronaldo': parseInt(await voting.methods.votes('Cristiano Ronaldo').call()),
        'Diego Maradona': parseInt(await voting.methods.votes('Diego Maradona').call())
      };
      const balance = await web3.eth.getBalance(voting.options.address);
      const voterVotes = parseInt(await voting.methods.voterVotes(this.state.currentAccount).call());
      this.setState({ votes, balance: web3.utils.fromWei(balance, 'ether'), voterVotes });
    } catch (error) {
      console.error("Error in onVote:", error);
      this.setState({ message: 'Transaction failed.' });
    }
  };

  onDeclareWinner = async () => {
    this.setState({ message: 'Declaring winner...' });

    try {
      await voting.methods.endVoting().send({
        from: this.state.currentAccount
      });

      this.setState({ message: 'Winner declared!' });

      // Fetch updated vote history after declaring winner
      const voteHistory = await voting.methods.getVoteHistory().call();
      this.setState({ voteHistory });
    } catch (error) {
      console.error("Error in onDeclareWinner:", error);
      this.setState({ message: 'Transaction failed.' });
    }
  };

  onWithdraw = async () => {
    this.setState({ message: 'Withdrawing funds...' });

    try {
      await voting.methods.withdraw().send({
        from: this.state.currentAccount
      });

      const balance = await web3.eth.getBalance(voting.options.address);
      this.setState({ message: 'Funds withdrawn!', balance: web3.utils.fromWei(balance, 'ether') });
    } catch (error) {
      console.error("Error in onWithdraw:", error);
      this.setState({ message: 'Transaction failed.' });
    }
  };

  onReset = async () => {
    this.setState({ message: 'Resetting votes...' });

    try {
      await voting.methods.resetVoting().send({
        from: this.state.currentAccount
      });

      const votes = {
        'Lionel Messi': 0,
        'Cristiano Ronaldo': 0,
        'Diego Maradona': 0
      };
      const balance = await web3.eth.getBalance(voting.options.address);
      this.setState({ votes, balance: web3.utils.fromWei(balance, 'ether'), voterVotes: 0, winner: '', message: 'Votes reset!' });
    } catch (error) {
      console.error("Error in onReset:", error);
      this.setState({ message: 'Transaction failed.' });
    }
  };

  onChangeOwner = async (newOwner) => {
    this.setState({ message: 'Changing owner...' });

    try {
      await voting.methods.changeOwner(newOwner).send({
        from: this.state.currentAccount
      });

      this.setState({ message: 'Owner changed!' });
    } catch (error) {
      console.error("Error in onChangeOwner:", error);
      this.setState({ message: 'Transaction failed.' });
    }
  };

  onDestroy = async () => {
    this.setState({ message: 'Disabling contract...' });

    try {
      await voting.methods.disableContract().send({
        from: this.state.currentAccount
      });

      this.setState({ message: 'Contract disabled!', contractDisabled: true });
    } catch (error) {
      console.error("Error in onDestroy:", error);
      this.setState({ message: 'Transaction failed.' });
    }
  };

  toggleHistory = () => {
    this.setState((prevState) => ({ historyVisible: !prevState.historyVisible }));
  }

  render() {
    const { manager, manager2, currentAccount, votes, voterVotes, balance, message, voteHistory, historyVisible, winner, isManager, contractDisabled, metamaskError } = this.state;
  
    const buttonStyle = {
      margin: '0 10px' // Adds margin to both left and right of the buttons
    };
  
    if (metamaskError) {
      return (
        <div className="container">
          <h2>Scrum Voting for the Best Footballer</h2>
          <div className="alert alert-danger" role="alert">
            {metamaskError}
          </div>
        </div>
      );
    }
  
    return (
      <div className="container">
        <div className="text-center">
          <h2>Scrum Voting for the Best Footballer</h2>
          <h4>Vote for the Greatest soccer player of all time</h4>
        </div>
  
        <div className="row">
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Owner's Address</h5>
                <p className="card-text">{manager}</p>
                <p className="card-text">{manager2}</p>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Current Address</h5>
                <p className="card-text">{currentAccount}</p>
              </div>
            </div>
          </div>
        </div>
  
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Contract Balance</h5>
                <p className="card-text">{balance} ether</p>
              </div>
            </div>
          </div>
        </div>
  
        <hr />
  
        <div className="row">
          {candidates.map(candidate => (
            <div className="col-md-4 mb-3" key={candidate.name}>
              <div className={`card ${winner === candidate.name ? 'bg-success text-white' : ''}`}>
                <img src={candidate.image} className="card-img-top" alt={candidate.name} />
                <div className="card-body text-center">
                  <h5 className="card-title">{candidate.name}</h5>
                  <button
                    className="btn btn-success btn-block"
                    onClick={() => this.onVote(candidate.name)}
                    disabled={winner !== '' || isManager || voterVotes >= 5 || contractDisabled}
                  >
                    Vote
                  </button>
                  <p className="card-text">Votes: {votes[candidate.name]}</p>
                  <p className="card-text">Remaining Votes: {5 - voterVotes}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
  
        <hr />
  
        <div className="row justify-content-center">
          <div className="col-md-4 mb-3 text-center">
            <button className="btn btn-primary btn-block" onClick={this.toggleHistory}>
              {historyVisible ? 'Hide' : 'Show'} Vote History
            </button>
          </div>
        </div>
  
        {historyVisible && (
          <div className="row justify-content-center">
            <div className="col-md-8">
              <h4 className="text-center">Vote History</h4>
              <ul className="list-group">
                {voteHistory.map((vote, index) => (
                  <li key={index} className="list-group-item">
                    {index + 1}. Winner: {vote.winner} with {vote.votesReceived} votes
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
  
        <hr />
  
        {isManager && (
          <div className="row justify-content-center">
            <div className="col-md-2 mb-3">
              <button className="btn btn-warning btn-block mb-2" style={buttonStyle} onClick={this.onDeclareWinner} disabled={winner !== ''}>Declare Winner</button>
            </div>
            <div className="col-md-2 mb-3">
              <button className="btn btn-warning btn-block mb-2" style={buttonStyle} onClick={this.onWithdraw}>Withdraw</button>
            </div>
            <div className="col-md-2 mb-3">
              <button className="btn btn-warning btn-block mb-2" style={buttonStyle} onClick={this.onReset} disabled={winner === ''}>Reset</button>
            </div>
            <div className="col-md-2 mb-3">
              <button className="btn btn-warning btn-block mb-2" style={buttonStyle} onClick={() => this.onChangeOwner(prompt("Enter new owner's wallet address:"))} disabled={winner === ''}>Change Owner</button>
            </div>
            <div className="col-md-2 mb-3">
              <button className="btn btn-danger btn-block mb-2" style={buttonStyle} onClick={this.onDestroy}>Destroy</button>
            </div>
          </div>
        )}
  
        <hr />
  
        <h1>{message}</h1>
      </div>
    );
  }
  
}

export default App;
